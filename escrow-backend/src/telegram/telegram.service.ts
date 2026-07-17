import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup } from 'telegraf';
import Redis from 'ioredis';
import { SellersService } from '../sellers/sellers.service';
import { DealsService } from '../deals/deals.service';
import { AiService } from '../ai/ai.service';
import { DealStatus } from '@prisma/client';

interface DraftDeal {
  buyerName?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  items: { name: string; unitPrice: number; quantity: number }[];
}

type DealFlowState = 'AWAITING_DEAL' | 'AWAITING_BUYER_PHONE';

const DRAFT_TTL_SECONDS = 60 * 30; // 30 min — abandoned drafts just expire

const CHITCHAT_WORDS = new Set(['hi', 'hello', 'hey', 'sup', 'test', 'ok', 'okay', 'thanks', 'thank you']);

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

  private readonly commandReference =
    "<b>Here's what I can do:</b>\n\n" +
    '📝 <b>Create a deal</b>\n' +
    'Just describe it naturally: "sold 2 phone cases to Musa 08012345678 for 3000 each"\n' +
    'Or use /add for a guided version.\n\n' +
    '📦 <b>Manage deals</b>\n' +
    '/deals — see everything currently in escrow\n' +
    '/ship &lt;code&gt; [estimated arrival date] — mark a deal as shipped, e.g. /ship A3F9K2 2026-07-20\n\n' +
    '❓ /help — show this message again';

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

    await this.bot.telegram.setMyCommands([
      { command: 'start', description: 'Get started / see all commands' },
      { command: 'add', description: 'Create a deal (guided)' },
      { command: 'deals', description: 'See all deals in escrow' },
      { command: 'ship', description: 'Mark a deal as shipped' },
      { command: 'help', description: 'Show all commands' },
    ]);

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

  /** Pulls an email and a phone number out of a free-text follow-up reply. */
  private parseContactReply(text: string): { phone?: string; email?: string } {
    const emailMatch = text.match(/[^\s]+@[^\s]+\.[^\s]+/);
    const email = emailMatch?.[0];
    const withoutEmail = email ? text.replace(email, ' ') : text;
    const phoneMatch = withoutEmail.match(/[\d()+\- ]{7,}/);
    const phone = phoneMatch?.[0]?.trim();
    return { phone, email };
  }

  /** Very short messages or common chit-chat aren't worth an AI extraction call. */
  private isChitChat(text: string): boolean {
    const trimmed = text.trim().toLowerCase();
    if (trimmed.length < 12) return true;
    return CHITCHAT_WORDS.has(trimmed);
  }

  /** Creates the deal from a completed draft and clears its Redis state. Caller must ensure buyerPhone is set. */
  private async finalizeDeal(ctx: any, sellerId: string, draft: DraftDeal & { buyerPhone: string }) {
    const telegramId = String(ctx.from.id);

    const deal = await this.dealsService.create({
      sellerId,
      buyerName: draft.buyerName,
      buyerPhone: draft.buyerPhone,
      buyerEmail: draft.buyerEmail,
      items: draft.items,
    });

    await this.redis.del(this.draftKey(telegramId));
    await this.redis.del(this.stateKey(telegramId));

    const publicUrl = `${this.config.get<string>('PUBLIC_FRONTEND_URL', '')}/pay/${deal.id}`;
    await ctx.reply(`Link created! Deal code: ${deal.shortCode}\nSend this to your buyer:\n${publicUrl}`);
  }

  /** Runs a free-text deal description through AI extraction and shows the review card. Shared by natural-language messages and /add. */
  private async handleNaturalLanguageDeal(ctx: any, telegramId: string, text: string) {
    const extracted = await this.aiService.extractDealFromText(text);
    if (!extracted.items?.length) {
      await ctx.reply(
        `I couldn't find a deal in that message. Here's what I can help with:\n\n${this.commandReference}`,
        { parse_mode: 'HTML' },
      );
      return;
    }

    const draft: DraftDeal = {
      buyerName: extracted.buyerName ?? undefined,
      buyerPhone: extracted.buyerPhone ?? undefined,
      buyerEmail: extracted.buyerEmail ?? undefined,
      items: extracted.items,
    };
    await this.redis.set(this.draftKey(telegramId), JSON.stringify(draft), 'EX', DRAFT_TTL_SECONDS);
    await this.setState(telegramId, 'AWAITING_DEAL');

    await this.sendReview(ctx, draft);
  }

  private registerHandlers() {
    this.bot.start(async (ctx) => {
      const seller = await this.sellersService.findByTelegramId(String(ctx.from.id));
      if (!seller) {
        await ctx.reply(
          "Welcome! Send me your email and business name to get started, e.g.\n" +
            '"musa@example.com, Musa Fashion Store"',
        );
      }
      await ctx.reply(this.commandReference, { parse_mode: 'HTML' });
    });

    this.bot.help(async (ctx) => {
      await ctx.reply(this.commandReference, { parse_mode: 'HTML' });
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

    // Structured alternative to natural-language deal creation.
    this.bot.command('add', async (ctx) => {
      const telegramId = String(ctx.from.id);
      const seller = await this.sellersService.findByTelegramId(telegramId);
      if (!seller) {
        await ctx.reply('Please send your email and business name first to sign up.');
        return;
      }

      const text = ctx.message.text.split(' ').slice(1).join(' ').trim();
      if (!text) {
        await ctx.reply(
          'Describe the deal — items, buyer name, and buyer phone (email optional) — all in one message.\n' +
            'Send it like this: 2 phone cases at 3000 each, 1 charger at 2000, buyer Musa 08012345678 musa@email.com',
        );
        return;
      }

      await this.handleNaturalLanguageDeal(ctx, telegramId, text);
    });

    // Lists everything currently in escrow, grouped by status.
    this.bot.command('deals', async (ctx) => {
      const seller = await this.sellersService.findByTelegramId(String(ctx.from.id));
      if (!seller) {
        await ctx.reply('Please sign up first — send your email and business name.');
        return;
      }

      const deals = await this.dealsService.listForSeller(seller.id);
      const liveStatuses: DealStatus[] = [DealStatus.PAID, DealStatus.SHIPPED, DealStatus.DISPUTED];
      const live = deals.filter((d) => liveStatuses.includes(d.status));

      if (!live.length) {
        await ctx.reply('No deals currently in escrow.');
        return;
      }

      const awaitingShipment = live.filter((d) => d.status === DealStatus.PAID);
      const shipped = live.filter((d) => d.status === DealStatus.SHIPPED);
      const disputed = live.filter((d) => d.status === DealStatus.DISPUTED);

      const formatRow = (code: string, buyer: string, amount: string, extra: string) =>
        `${code.padEnd(7)}${buyer.slice(0, 10).padEnd(11)}₦${amount.padEnd(9)}${extra}`;

      let message = '';

      if (awaitingShipment.length) {
        message += '📦 <b>Paid — awaiting shipment</b>\n<pre>';
        message += 'Code   Buyer      Amount    \n';
        for (const d of awaitingShipment) {
          message += formatRow(d.shortCode, d.buyerName ?? d.buyerPhone, Number(d.amount).toLocaleString(), '') + '\n';
        }
        message += '</pre>\nMark shipped: /ship &lt;code&gt; [date]\n\n';
      }

      if (shipped.length) {
        message += '🚚 <b>Shipped — awaiting buyer confirmation</b>\n<pre>';
        message += 'Code   Buyer      Amount     ETA\n';
        for (const d of shipped) {
          const eta = d.estimatedDeliveryDate ? new Date(d.estimatedDeliveryDate).toLocaleDateString() : '-';
          message += formatRow(d.shortCode, d.buyerName ?? d.buyerPhone, Number(d.amount).toLocaleString(), eta) + '\n';
        }
        message += '</pre>\n\n';
      }

      if (disputed.length) {
        message += '⚠️ <b>Disputed</b>\n<pre>';
        message += 'Code   Buyer      Amount    \n';
        for (const d of disputed) {
          message += formatRow(d.shortCode, d.buyerName ?? d.buyerPhone, Number(d.amount).toLocaleString(), '') + '\n';
        }
        message += '</pre>';
      }

      await ctx.reply(message, { parse_mode: 'HTML' });
    });

    // Seller marks a paid deal as shipped, e.g. "/ship A3F9K2 2026-07-20"
    this.bot.command('ship', async (ctx) => {
      const [shortCode, etaStr] = ctx.message.text.split(' ').slice(1);
      if (!shortCode) {
        await ctx.reply(
          'Which deal? Reply with: /ship <code> [expected delivery date, e.g. 2026-07-20]. Use /deals to see your deal codes.',
        );
        return;
      }

      try {
        const deal = await this.dealsService.findByShortCode(shortCode);
        const eta = etaStr ? new Date(etaStr) : undefined;
        const updated = await this.dealsService.markShipped(deal.id, eta);
        await ctx.reply(
          `📦 Deal ${updated.shortCode} marked as shipped${etaStr ? ` — estimated delivery ${etaStr}` : ''}. We'll let the buyer know.`,
        );
      } catch (err) {
        this.logger.error(`/ship failed for "${ctx.message.text}":`, err);
        await ctx.reply("Couldn't mark that deal as shipped — check the deal code and try again.");
      }
    });

    // Natural-language deal creation, or a reply to a pending follow-up question.
    // Must be registered after the command() handlers above — Telegraf's
    // generic text matcher would otherwise swallow every /command message
    // before the command-specific handlers ever get a turn.
    this.bot.on('text', async (ctx) => {
      const telegramId = String(ctx.from.id);
      const seller = await this.sellersService.findByTelegramId(telegramId);
      if (!seller) {
        await ctx.reply('Please send your email and business name first to sign up.');
        return;
      }

      const state = await this.getState(telegramId);

      if (state === 'AWAITING_BUYER_PHONE') {
        const { phone, email } = this.parseContactReply(ctx.message.text);
        if (!phone || !this.looksLikePhoneNumber(phone)) {
          await ctx.reply("That doesn't look like a phone number — please send the buyer's phone number (and optionally their email).");
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
        if (email) draft.buyerEmail = email;
        await this.redis.set(this.draftKey(telegramId), JSON.stringify(draft), 'EX', DRAFT_TTL_SECONDS);
        await this.setState(telegramId, 'AWAITING_DEAL');

        await this.finalizeDeal(ctx, seller.id, draft as DraftDeal & { buyerPhone: string });
        return;
      }

      if (this.isChitChat(ctx.message.text)) {
        await ctx.reply(this.commandReference, { parse_mode: 'HTML' });
        return;
      }

      await this.handleNaturalLanguageDeal(ctx, telegramId, ctx.message.text);
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
        await ctx.reply("What's the buyer's phone number? (You can also include their email if you have it.)");
        return;
      }

      await this.finalizeDeal(ctx, seller.id, draft as DraftDeal & { buyerPhone: string });
    });

    this.bot.action('edit_deal', async (ctx) => {
      await ctx.reply('What would you like to change — items, buyer info, or price? Just tell me.');
    });
  }

  private async sendReview(ctx: any, draft: DraftDeal) {
    const total = draft.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const itemLines = draft.items
      .map((i) => `${i.name} x${i.quantity} (₦${i.unitPrice.toLocaleString()} each)`)
      .join('\n');

    await ctx.reply(
      `Review deal\nBuyer: ${draft.buyerName ?? 'not specified'}\nPhone: ${draft.buyerPhone ?? 'not provided'}\nEmail: ${draft.buyerEmail ?? 'not provided'}\n${itemLines}\nTotal: ₦${total.toLocaleString()}`,
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
