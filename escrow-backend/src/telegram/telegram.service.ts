import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import Redis from 'ioredis';
import { SellersService } from '../sellers/sellers.service';
import { DealsService } from '../deals/deals.service';
import { AiService } from '../ai/ai.service';
import { EmailService } from '../email/email.service';
import { StorageService } from '../storage/storage.service';
import { MonnifyService } from '../monnify/monnify.service';
import { DealStatus } from '../generated/prisma/client';

interface DraftDealItem {
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string;
}

interface DraftDeal {
  buyerName?: string;
  buyerPhone?: string;
  buyerEmail?: string;
  items: DraftDealItem[];
}

type ConversationState = 'AWAITING_DEAL' | 'AWAITING_BUYER_PHONE' | 'AWAITING_OTP';

const DRAFT_TTL_SECONDS = 60 * 30; // 30 min — abandoned drafts just expire
const OTP_TTL_SECONDS = 600; // 10 min
const BANK_CONFIRM_TTL_SECONDS = 600; // 10 min — window to tap Confirm/Cancel after /bank
const BANKS_CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours — the bank list rarely changes
const BANKS_CACHE_KEY = 'monnify:banks';
const BOT_STARTUP_TIMEOUT_MS = 15_000; // cap on Telegram API calls during boot — a hang shouldn't block the rest of the app

const CHITCHAT_WORDS = new Set(['hi', 'hello', 'hey', 'sup', 'test', 'ok', 'okay', 'thanks', 'thank you']);

const EMAIL_PATTERN = /[^\s]+@[^\s]+\.[^\s]+/;

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

  private readonly introText =
    "ZapEscrow holds your buyer's payment safely until they confirm they've received their order, " +
    "then releases it to you automatically. No more chasing payments or losing sales to distrustful buyers.\n\n";

  private readonly commandReference =
    "<b>Here's what I can do:</b>\n\n" +
    '📝 <b>Create a deal</b>\n' +
    'Just describe it naturally: "sold 2 phone cases to Musa 08012345678 for 3000 each"\n' +
    'Or use /add for a guided version.\n\n' +
    '📦 <b>Manage deals</b>\n' +
    '/deals — see everything currently in escrow\n' +
    '/ship &lt;code&gt; [estimated arrival date] — mark a deal as shipped, e.g. /ship A3F9K2 2026-07-20 (run it again on a shipped deal to update the estimate)\n\n' +
    '👤 <b>Account</b>\n' +
    '/profile — view your account details\n' +
    '/verify — verify your email\n' +
    '/bank &lt;account number&gt; &lt;bank name&gt; — set where payouts get sent\n\n' +
    '❓ /help — show this message again';

  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => SellersService))
    private readonly sellersService: SellersService,
    @Inject(forwardRef(() => DealsService))
    private readonly dealsService: DealsService,
    private readonly aiService: AiService,
    private readonly emailService: EmailService,
    private readonly storageService: StorageService,
    private readonly monnifyService: MonnifyService,
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

    try {
      await this.withTimeout(
        this.bot.telegram.setMyCommands([
          { command: 'start', description: 'Get started / see all commands' },
          { command: 'add', description: 'Create a deal (guided)' },
          { command: 'deals', description: 'See all deals in escrow' },
          { command: 'ship', description: 'Mark a deal as shipped' },
          { command: 'profile', description: 'View your account details' },
          { command: 'verify', description: 'Verify your email' },
          { command: 'bank', description: 'Set your payout account' },
          { command: 'help', description: 'Show all commands' },
        ]),
        BOT_STARTUP_TIMEOUT_MS,
        'setMyCommands',
      );
    } catch (err) {
      this.logger.error('Failed to register the bot command menu with Telegram — continuing without it:', err);
    }

    this.registerHandlers();

    // Network calls to Telegram's API (launch/setWebhook) can fail or hang —
    // don't let that block the rest of the app (DB, HTTP API, dashboard) from starting.
    try {
      const useWebhook = this.config.get<string>('TELEGRAM_USE_WEBHOOK') === 'true';
      if (useWebhook) {
        const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL');
        if (webhookUrl) {
          await this.withTimeout(this.bot.telegram.setWebhook(webhookUrl), BOT_STARTUP_TIMEOUT_MS, 'setWebhook');
        } else {
          this.logger.warn('TELEGRAM_USE_WEBHOOK is true but TELEGRAM_WEBHOOK_URL is not set — webhook not registered');
        }
      } else {
        await this.withTimeout(this.bot.launch(), BOT_STARTUP_TIMEOUT_MS, 'bot.launch');
        this.logger.log('Telegram bot launched in polling mode');
      }
    } catch (err) {
      this.logger.error('Failed to start the Telegram bot — the rest of the app will still start:', err);
    }
  }

  /** Races a promise against a timeout so a hung network call can't block app startup indefinitely. */
  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private draftKey(telegramId: string) {
    return `deal-draft:${telegramId}`;
  }

  private stateKey(telegramId: string) {
    return `deal-state:${telegramId}`;
  }

  private otpKey(telegramId: string) {
    return `otp:${telegramId}`;
  }

  private pendingBankKey(telegramId: string) {
    return `bank-pending:${telegramId}`;
  }

  private pendingPhotoKey(telegramId: string) {
    return `photo-pending:${telegramId}`;
  }

  private pendingSignupKey(telegramId: string) {
    return `signup-pending:${telegramId}`;
  }

  private async setState(telegramId: string, state: ConversationState) {
    await this.redis.set(this.stateKey(telegramId), state, 'EX', DRAFT_TTL_SECONDS);
  }

  private async getState(telegramId: string): Promise<ConversationState> {
    const state = await this.redis.get(this.stateKey(telegramId));
    if (state === 'AWAITING_BUYER_PHONE' || state === 'AWAITING_OTP') return state;
    return 'AWAITING_DEAL';
  }

  private looksLikePhoneNumber(text: string): boolean {
    return /^\+?[\d\s()-]{7,15}$/.test(text.trim());
  }

  /** Escapes user-controlled text before interpolating it into a parse_mode: 'HTML' message. */
  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

  private generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  /** Monnify's full bank list, cached in Redis since it rarely changes and /bank shouldn't hit the API on every call. */
  private async getBanksCached(): Promise<{ name: string; code: string }[]> {
    const cached = await this.redis.get(BANKS_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // fall through and refetch on corrupt cache
      }
    }

    const banks = await this.monnifyService.getBanks();
    await this.redis.set(BANKS_CACHE_KEY, JSON.stringify(banks), 'EX', BANKS_CACHE_TTL_SECONDS);
    return banks;
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

    await ctx.reply(
      `Link created! Code: ${deal.shortCode}\n\nSend this to your buyer:\n${publicUrl}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Copy link', copy_text: { text: publicUrl } }],
            [
              {
                text: '↗️ Share via Telegram',
                url: `https://t.me/share/url?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent("Here's your secure payment link — your money stays protected in escrow until you confirm you received your order.")}`,
              },
            ],
          ],
        } as any,
      },
    );
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
            '"musa@example.com Musa Fashion Store"',
        );
      }
      await ctx.reply(this.introText + this.commandReference, { parse_mode: 'HTML' });
    });

    this.bot.help(async (ctx) => {
      await ctx.reply(this.introText + this.commandReference, { parse_mode: 'HTML' });
    });

    // Seller onboarding — matches an email anywhere in the message; whatever
    // text is left over (comma or no comma) becomes the business name. If
    // nothing's left over, we ask for it as a follow-up instead of failing.
    this.bot.hears(EMAIL_PATTERN, async (ctx, next) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) return next(); // let command handlers (e.g. /add with a buyer email) take this

      const telegramId = String(ctx.from.id);
      const existing = await this.sellersService.findByTelegramId(telegramId);
      if (existing) return next(); // already signed up — likely a deal message that happens to mention an email

      const emailMatch = text.match(EMAIL_PATTERN);
      const email = emailMatch![0];
      const businessName = text.replace(email, ' ').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

      if (!businessName) {
        await this.redis.set(this.pendingSignupKey(telegramId), email, 'EX', OTP_TTL_SECONDS);
        await ctx.reply("What's your business name?");
        return;
      }

      const seller = await this.sellersService.createFromTelegram({ email, businessName, telegramId });
      await this.setState(telegramId, 'AWAITING_DEAL');
      await ctx.reply(
        `You're set up, ${seller.businessName}! Let's verify your email next — run /verify.\n\n` +
          'Once verified, describe a deal, e.g.\n"sold 2 phone cases to Musa for 3000 each and a charger for 2000"',
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

    // Lists everything currently in escrow, one card per deal, grouped by status.
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

      const fmtDate = (d?: Date | null) =>
        d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '-';

      const awaitingShipment = live.filter((d) => d.status === DealStatus.PAID);
      const shipped = live.filter((d) => d.status === DealStatus.SHIPPED);
      const disputed = live.filter((d) => d.status === DealStatus.DISPUTED);

      let message = `<b>Deals in escrow (${live.length})</b>\n`;
      const copyButtons: { text: string; copy_text: { text: string } }[][] = [];

      if (awaitingShipment.length) {
        message += `\n📦 <b>Paid — awaiting shipment</b>\n`;
        for (const d of awaitingShipment) {
          message +=
            `\n<b>${d.shortCode}</b> — ${this.escapeHtml(d.buyerName ?? d.buyerPhone)}\n` +
            `₦${Number(d.amount).toLocaleString()} · Paid ${fmtDate(d.paidAt)}\n`;
          copyButtons.push([{ text: `📋 Copy ${d.shortCode}`, copy_text: { text: d.shortCode } }]);
        }
        message += `<i>Mark shipped: /ship &lt;code&gt; [date]</i>\n`;
      }

      if (shipped.length) {
        message += `\n🚚 <b>Shipped — awaiting buyer confirmation</b>\n`;
        for (const d of shipped) {
          message +=
            `\n<b>${d.shortCode}</b> — ${this.escapeHtml(d.buyerName ?? d.buyerPhone)}\n` +
            `₦${Number(d.amount).toLocaleString()} · ETA ${fmtDate(d.estimatedDeliveryDate)} · Releases ${fmtDate(d.autoReleaseDeadline)}\n`;
          copyButtons.push([{ text: `📋 Copy ${d.shortCode}`, copy_text: { text: d.shortCode } }]);
        }
        message += `<i>If the buyer doesn't respond by the release date, funds are automatically released to you.</i>\n`;
      }

      if (disputed.length) {
        message += `\n⚠️ <b>Disputed</b>\n`;
        for (const d of disputed) {
          message +=
            `\n<b>${d.shortCode}</b> — ${this.escapeHtml(d.buyerName ?? d.buyerPhone)}\n` +
            `₦${Number(d.amount).toLocaleString()} · Paid ${fmtDate(d.paidAt)}\n`;
          copyButtons.push([{ text: `📋 Copy ${d.shortCode}`, copy_text: { text: d.shortCode } }]);
        }
      }

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: copyButtons } as any,
      });
    });

    // Seller marks a paid deal as shipped, e.g. "/ship A3F9K2 2026-07-20"
    this.bot.command('ship', async (ctx) => {
      const [shortCode, ...etaParts] = ctx.message.text.split(' ').slice(1);
      const etaStr = etaParts.join(' ');
      if (!shortCode) {
        await ctx.reply(
          'Which deal? Reply with: /ship <code> [expected delivery date, e.g. 2026-07-20]. Use /deals to see your deal codes.',
        );
        return;
      }

      const eta = etaStr ? new Date(etaStr) : undefined;
      if (eta && Number.isNaN(eta.getTime())) {
        await ctx.reply(`I couldn't understand "${etaStr}" as a date — try YYYY-MM-DD, e.g. 2026-07-20.`);
        return;
      }

      try {
        const deal = await this.dealsService.findByShortCode(shortCode);
        const wasAlreadyShipped = deal.status === DealStatus.SHIPPED;
        const updated = await this.dealsService.markShipped(deal.id, eta);
        const reply = wasAlreadyShipped
          ? `📦 Updated the delivery estimate for ${updated.shortCode}${etaStr ? ` — now ${etaStr}` : ''}.`
          : `📦 Deal ${updated.shortCode} marked as shipped${etaStr ? ` — estimated delivery ${etaStr}` : ''}. We'll let the buyer know.`;
        await ctx.reply(reply);
      } catch (err) {
        this.logger.error(`/ship failed for "${ctx.message.text}":`, err);
        await ctx.reply("Couldn't mark that deal as shipped — check the deal code and try again.");
      }
    });

    // Shows the seller their own account details.
    this.bot.command('profile', async (ctx) => {
      const telegramId = String(ctx.from.id);
      const seller = await this.sellersService.findByTelegramId(telegramId);
      if (!seller) {
        await ctx.reply('Please send your email and business name first to sign up.');
        return;
      }

      await ctx.reply(
        `<b>Your profile</b>\nEmail: ${this.escapeHtml(seller.email)}\nBusiness name: ${this.escapeHtml(seller.businessName)}`,
        { parse_mode: 'HTML' },
      );
    });

    // Sends a 6-digit code to the seller's email and puts them in AWAITING_OTP state.
    this.bot.command('verify', async (ctx) => {
      const telegramId = String(ctx.from.id);
      const seller = await this.sellersService.findByTelegramId(telegramId);
      if (!seller) {
        await ctx.reply('Please send your email and business name first to sign up.');
        return;
      }

      if (seller.emailVerifiedAt) {
        await ctx.reply('Your email is already verified. ✅');
        return;
      }

      try {
        const code = this.generateOtp();
        await this.redis.set(this.otpKey(telegramId), code, 'EX', OTP_TTL_SECONDS);
        await this.setState(telegramId, 'AWAITING_OTP');

        await this.emailService.sendOtp(seller.email, code);
        await ctx.reply('Check your email for a 6-digit code, then reply with it here.');
      } catch (err) {
        this.logger.error(`/verify failed to send OTP for seller ${seller.id}:`, err);
        await ctx.reply("Couldn't send the verification email — please try /verify again shortly.");
      }
    });

    // Sets up (or updates) where escrow payouts get disbursed.
    this.bot.command('bank', async (ctx) => {
      const telegramId = String(ctx.from.id);
      const seller = await this.sellersService.findByTelegramId(telegramId);
      if (!seller) {
        await ctx.reply('Please send your email and business name first to sign up.');
        return;
      }

      if (!seller.emailVerifiedAt) {
        await ctx.reply('Please verify your email first — run /verify');
        return;
      }

      const args = ctx.message.text.split(' ').slice(1);
      if (args.length < 2) {
        await ctx.reply('Send your account number and bank name together, e.g.\n/bank 0123456789 GTBank');
        return;
      }

      const [accountNumber, ...bankNameParts] = args;
      const bankNameInput = bankNameParts.join(' ');

      let banks: { name: string; code: string }[];
      try {
        banks = await this.getBanksCached();
      } catch (err) {
        this.logger.error('Failed to fetch bank list from Monnify:', err);
        await ctx.reply("Couldn't fetch the bank list right now — please try again shortly.");
        return;
      }

      const match = banks.find((b) => b.name.toLowerCase().includes(bankNameInput.toLowerCase()));
      if (!match) {
        await ctx.reply(
          `I couldn't find a bank matching "${bankNameInput}" — try the exact bank name, e.g. "Fidelity Bank" or "GTBank".`,
        );
        return;
      }
      const bankCode = match.code;

      try {
        const result = await this.monnifyService.nameEnquiry(accountNumber, bankCode);
        const resolvedName = result?.responseBody?.accountName;
        if (!resolvedName) {
          await ctx.reply("Couldn't resolve that account — double-check the account number and bank.");
          return;
        }

        await this.redis.set(
          this.pendingBankKey(telegramId),
          JSON.stringify({ accountNumber, bankCode }),
          'EX',
          BANK_CONFIRM_TTL_SECONDS,
        );

        await ctx.reply(
          `Confirm this is you: ${resolvedName}?`,
          Markup.inlineKeyboard([
            Markup.button.callback('✅ Confirm', 'confirm_bank'),
            Markup.button.callback('❌ Cancel', 'cancel_bank'),
          ]),
        );
      } catch (err) {
        this.logger.error(`/bank nameEnquiry failed for "${ctx.message.text}":`, err);
        await ctx.reply("Couldn't verify that account — double-check the details and try again.");
      }
    });

    // A photo attached to an in-progress draft — ask which item it belongs to.
    this.bot.on(message('photo'), async (ctx) => {
      const telegramId = String(ctx.from.id);
      const seller = await this.sellersService.findByTelegramId(telegramId);
      if (!seller) return;

      const raw = await this.redis.get(this.draftKey(telegramId));
      if (!raw) return; // no active draft — nothing to attach the photo to

      const draft: DraftDeal = JSON.parse(raw);
      if (!draft.items.length) return;

      const photoSizes = ctx.message.photo;
      const largest = photoSizes[photoSizes.length - 1];

      try {
        const fileLink = await ctx.telegram.getFileLink(largest.file_id);
        const path = `deal-items/${telegramId}-${Date.now()}.jpg`;
        const imageUrl = await this.storageService.uploadFromUrl(fileLink.toString(), path);

        await this.redis.set(this.pendingPhotoKey(telegramId), imageUrl, 'EX', DRAFT_TTL_SECONDS);

        await ctx.reply(
          'Which item is this photo for?',
          Markup.inlineKeyboard(
            draft.items.map((item, index) => [Markup.button.callback(item.name, `photo_item_${index}`)]),
          ),
        );
      } catch (err) {
        this.logger.error('Photo upload failed:', err);
        await ctx.reply("Couldn't process that photo — please try again.");
      }
    });

    // Natural-language deal creation, or a reply to a pending follow-up question.
    // Must be registered after the command() handlers above — Telegraf's
    // generic text matcher would otherwise swallow every /command message
    // before the command-specific handlers ever get a turn.
    this.bot.on(message('text'), async (ctx) => {
      const telegramId = String(ctx.from.id);

      const pendingEmail = await this.redis.get(this.pendingSignupKey(telegramId));
      if (pendingEmail) {
        const businessName = ctx.message.text.trim();
        if (!businessName) {
          await ctx.reply("What's your business name?");
          return;
        }

        const seller = await this.sellersService.createFromTelegram({
          email: pendingEmail,
          businessName,
          telegramId,
        });
        await this.redis.del(this.pendingSignupKey(telegramId));
        await this.setState(telegramId, 'AWAITING_DEAL');
        await ctx.reply(
          `You're set up, ${seller.businessName}! Let's verify your email next — run /verify.\n\n` +
            'Once verified, describe a deal, e.g.\n"sold 2 phone cases to Musa for 3000 each and a charger for 2000"',
        );
        return;
      }

      const seller = await this.sellersService.findByTelegramId(telegramId);
      if (!seller) {
        await ctx.reply('Please send your email and business name first to sign up.');
        return;
      }

      const state = await this.getState(telegramId);

      if (state === 'AWAITING_OTP') {
        const input = ctx.message.text.trim();
        if (!/^\d{6}$/.test(input)) {
          await ctx.reply("That doesn't look like a 6-digit code — check your email and try again, or /verify to resend.");
          return;
        }

        const stored = await this.redis.get(this.otpKey(telegramId));
        if (stored && stored === input) {
          await this.sellersService.updateEmailVerified(seller.id);
          await this.redis.del(this.otpKey(telegramId));
          await this.setState(telegramId, 'AWAITING_DEAL');
          await ctx.reply('✅ Email verified!');
        } else {
          await ctx.reply("That code doesn't match — try again or /verify to resend.");
        }
        return;
      }

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

    this.bot.action('confirm_bank', async (ctx) => {
      const telegramId = String(ctx.from.id);
      const seller = await this.sellersService.findByTelegramId(telegramId);
      if (!seller) {
        await ctx.reply('Please send your email and business name first to sign up.');
        return;
      }

      const raw = await this.redis.get(this.pendingBankKey(telegramId));
      if (!raw) {
        await ctx.reply('That confirmation expired — run /bank again.');
        return;
      }

      const { accountNumber, bankCode } = JSON.parse(raw);
      await this.sellersService.updateSettlementAccount(seller.id, accountNumber, bankCode);
      await this.redis.del(this.pendingBankKey(telegramId));
      await ctx.reply('✅ Settlement account saved — that\'s where your payouts will go.');
    });

    this.bot.action('cancel_bank', async (ctx) => {
      const telegramId = String(ctx.from.id);
      await this.redis.del(this.pendingBankKey(telegramId));
      await ctx.reply("Cancelled — run /bank again whenever you're ready.");
    });

    this.bot.action(/^photo_item_(\d+)$/, async (ctx) => {
      const telegramId = String(ctx.from.id);
      const index = Number(ctx.match[1]);

      const imageUrl = await this.redis.get(this.pendingPhotoKey(telegramId));
      if (!imageUrl) {
        await ctx.reply('That photo expired — please resend it.');
        return;
      }

      const raw = await this.redis.get(this.draftKey(telegramId));
      if (!raw) {
        await ctx.reply('This draft expired — please describe the deal again.');
        return;
      }

      const draft: DraftDeal = JSON.parse(raw);
      const item = draft.items[index];
      if (!item) {
        await ctx.reply("Couldn't find that item — please try again.");
        return;
      }

      item.imageUrl = imageUrl;
      await this.redis.set(this.draftKey(telegramId), JSON.stringify(draft), 'EX', DRAFT_TTL_SECONDS);
      await this.redis.del(this.pendingPhotoKey(telegramId));

      await ctx.reply(`Photo added to ${item.name}.`);
      // Re-show the review card with Confirm/Edit buttons so the seller can
      // proceed immediately, instead of needing to type a follow-up message
      // that the AWAITING_DEAL text handler wouldn't recognize as "confirm".
      await this.sendReview(ctx, draft);
    });
  }

  private async sendReview(ctx: any, draft: DraftDeal) {
    const total = draft.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const itemLines = draft.items
      .map((i) => `${i.imageUrl ? '📷 ' : ''}${i.name} x${i.quantity} (₦${i.unitPrice.toLocaleString()} each)`)
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
