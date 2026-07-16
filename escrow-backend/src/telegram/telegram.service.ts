import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup } from 'telegraf';
import Redis from 'ioredis';
import { SellersService } from '../sellers/sellers.service';
import { DealsService } from '../deals/deals.service';
import { AiService } from '../ai/ai.service';

interface DraftDeal {
  buyerName?: string;
  buyerPhone?: string;
  items: { name: string; unitPrice: number; quantity: number }[];
}

type DealFlowState = 'AWAITING_DEAL' | 'AWAITING_BUYER_PHONE';

const DRAFT_TTL_SECONDS = 60 * 30; // 30 min — abandoned drafts just expire

/**
 * In-progress deals live in Redis, keyed by telegramId, and are never
 * written to Postgres until the seller taps "Confirm & create link".
 * See project notes on why drafts are kept ephemeral.
 */
@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf;
  private redis: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly sellersService: SellersService,
    @Inject(forwardRef(() => DealsService))
    private readonly dealsService: DealsService,
    private readonly aiService: AiService,
  ) {
    this.redis = new Redis(this.config.get<string>('REDIS_URL', 'redis://localhost:6379'));
  }

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — bot not started');
      return;
    }

    this.bot = new Telegraf(token);
    this.bot.catch((err, ctx) => {
      this.logger.error(`Telegraf error for update ${ctx.updateType}:`, err);
      ctx.reply('Something went wrong processing that — please try again.').catch(() => {});
    });
    this.registerHandlers();

    const useWebhook = this.config.get<string>('TELEGRAM_USE_WEBHOOK') === 'true';
    if (useWebhook) {
      const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL');
      if (webhookUrl) {
        await this.bot.telegram.setWebhook(webhookUrl);
      } else {
        this.logger.warn('TELEGRAM_USE_WEBHOOK is true but TELEGRAM_WEBHOOK_URL is not set — webhook not registered');
      }
    } else {
      this.bot.launch();
      this.logger.log('Telegram bot launched in polling mode');
    }
  }

  private draftKey(telegramId: string) {
    return `deal-draft:${telegramId}`;
  }

  private stateKey(telegramId: string) {
    return `deal-state:${telegramId}`;
  }

  private async setState(telegramId: string, state: DealFlowState) {
    await this.redis.set(this.stateKey(telegramId), state, 'EX', DRAFT_TTL_SECONDS);
  }

  private async getState(telegramId: string): Promise<DealFlowState> {
    const state = await this.redis.get(this.stateKey(telegramId));
    return state === 'AWAITING_BUYER_PHONE' ? 'AWAITING_BUYER_PHONE' : 'AWAITING_DEAL';
  }

  private looksLikePhoneNumber(text: string): boolean {
    return /^\+?[\d\s()-]{7,15}$/.test(text.trim());
  }

  private stateHint(state: DealFlowState): string {
    return state === 'AWAITING_BUYER_PHONE'
      ? "I'm still waiting for the buyer's phone number — please send just the number."
      : 'Describe a deal, e.g. "sold 2 phone cases to Musa for 3000 each and a charger for 2000".';
  }

  /** Creates the deal from a completed draft and clears its Redis state. Caller must ensure buyerPhone is set. */
  private async finalizeDeal(ctx: any, sellerId: string, draft: DraftDeal & { buyerPhone: string }) {
    const telegramId = String(ctx.from.id);

    const deal = await this.dealsService.create({
      sellerId,
      buyerName: draft.buyerName,
      buyerPhone: draft.buyerPhone,
      items: draft.items,
    });

    await this.redis.del(this.draftKey(telegramId));
    await this.redis.del(this.stateKey(telegramId));

    const publicUrl = `${this.config.get<string>('PUBLIC_FRONTEND_URL', '')}/pay/${deal.id}`;
    await ctx.reply(`Link created! Send this to your buyer:\n${publicUrl}`);
  }

  private registerHandlers() {
    this.bot.start(async (ctx) => {
      await ctx.reply(
        "Welcome! Send me your email and business name to get started, e.g.\n" +
          '"musa@example.com, Musa Fashion Store"',
      );
    });

    // Very naive seller onboarding — a real build should validate this properly.
    this.bot.hears(/@.+,.+/, async (ctx) => {
      const [email, businessName] = ctx.message.text.split(',').map((s) => s.trim());
      const seller = await this.sellersService.createFromTelegram({
        email,
        businessName,
        telegramId: String(ctx.from.id),
      });
      await this.setState(String(ctx.from.id), 'AWAITING_DEAL');
      await ctx.reply(
        `You're set up, ${seller.businessName}! Now describe a deal, e.g.\n` +
          '"sold 2 phone cases to Musa for 3000 each and a charger for 2000"',
      );
    });

    // Natural-language deal creation, or a reply to a pending follow-up question
    this.bot.on('text', async (ctx) => {
      const telegramId = String(ctx.from.id);
      const seller = await this.sellersService.findByTelegramId(telegramId);
      if (!seller) {
        await ctx.reply('Please send your email and business name first to sign up.');
        return;
      }

      const state = await this.getState(telegramId);

      if (state === 'AWAITING_BUYER_PHONE') {
        const phone = ctx.message.text.trim();
        if (!this.looksLikePhoneNumber(phone)) {
          await ctx.reply(`That doesn't look like a phone number. ${this.stateHint(state)}`);
          return;
        }

        const raw = await this.redis.get(this.draftKey(telegramId));
        if (!raw) {
          await this.redis.del(this.stateKey(telegramId));
          await ctx.reply('This draft expired — please describe the deal again.');
          return;
        }

        const draft: DraftDeal = JSON.parse(raw);
        draft.buyerPhone = phone;
        await this.redis.set(this.draftKey(telegramId), JSON.stringify(draft), 'EX', DRAFT_TTL_SECONDS);
        await this.setState(telegramId, 'AWAITING_DEAL');

        await this.finalizeDeal(ctx, seller.id, draft as DraftDeal & { buyerPhone: string });
        return;
      }

      const extracted = await this.aiService.extractDealFromText(ctx.message.text);
      if (!extracted.items?.length) {
        await ctx.reply(`I couldn't find any items in that — try again with item names and prices. ${this.stateHint(state)}`);
        return;
      }

      const draft: DraftDeal = { buyerName: extracted.buyerName, items: extracted.items };
      await this.redis.set(this.draftKey(telegramId), JSON.stringify(draft), 'EX', DRAFT_TTL_SECONDS);
      await this.setState(telegramId, 'AWAITING_DEAL');

      await this.sendReview(ctx, draft);
    });

    this.bot.action('confirm_deal', async (ctx) => {
      const telegramId = String(ctx.from.id);
      const raw = await this.redis.get(this.draftKey(telegramId));
      if (!raw) {
        await ctx.reply('This draft expired — please describe the deal again.');
        return;
      }
      const draft: DraftDeal = JSON.parse(raw);
      const seller = await this.sellersService.findByTelegramId(telegramId);
      if (!seller) {
        await ctx.reply('Please send your email and business name first to sign up.');
        return;
      }

      if (!draft.buyerPhone) {
        await this.setState(telegramId, 'AWAITING_BUYER_PHONE');
        await ctx.reply("What's the buyer's phone number?");
        return;
      }

      await this.finalizeDeal(ctx, seller.id, draft as DraftDeal & { buyerPhone: string });
    });

    this.bot.action('edit_deal', async (ctx) => {
      await ctx.reply('What would you like to change — items, buyer info, or price? Just tell me.');
    });

    // Seller marks a paid deal as shipped, e.g. "/ship <dealId> 2026-07-20"
    this.bot.command('ship', async (ctx) => {
      const [dealId, etaStr] = ctx.message.text.split(' ').slice(1);
      if (!dealId) {
        await ctx.reply("Usage: /ship <dealId> [YYYY-MM-DD]");
        return;
      }

      try {
        const eta = etaStr ? new Date(etaStr) : undefined;
        const deal = await this.dealsService.markShipped(dealId, eta);
        await ctx.reply(
          `📦 Deal ${deal.id} marked as shipped${etaStr ? ` — estimated delivery ${etaStr}` : ''}. We'll let the buyer know.`,
        );
      } catch (err) {
        this.logger.error(`/ship failed for "${ctx.message.text}":`, err);
        await ctx.reply("Couldn't mark that deal as shipped — check the deal id and try again.");
      }
    });
  }

  private async sendReview(ctx: any, draft: DraftDeal) {
    const total = draft.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const itemLines = draft.items
      .map((i) => `${i.name} x${i.quantity} (₦${i.unitPrice.toLocaleString()} each)`)
      .join('\n');

    await ctx.reply(
      `Review deal\nBuyer: ${draft.buyerName ?? 'not specified'}\n${itemLines}\nTotal: ₦${total.toLocaleString()}`,
      Markup.inlineKeyboard([
        Markup.button.callback('✅ Confirm & create link', 'confirm_deal'),
        Markup.button.callback('✏️ Edit', 'edit_deal'),
      ]),
    );
  }

  /** Used by the scheduler to send digests / deadline reminders / confirm-receipt prompts. */
  async sendMessage(telegramId: string, text: string) {
    if (!this.bot) return;
    await this.bot.telegram.sendMessage(telegramId, text);
  }
}
