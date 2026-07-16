import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DealsService } from '../deals/deals.service';
import { TelegramService } from '../telegram/telegram.service';
import { AiService } from '../ai/ai.service';
import { DealStatus } from '@prisma/client';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dealsService: DealsService,
    private readonly telegramService: TelegramService,
    private readonly aiService: AiService,
  ) {}

  /** Runs daily at 7am — sends each active seller their escrow digest. */
  @Cron('0 7 * * *')
  async sendDailyDigests() {
    const sellers = await this.prisma.seller.findMany({
      where: {
        telegramId: { not: null },
        deals: { some: { status: { in: [DealStatus.PAID, DealStatus.SHIPPED, DealStatus.DISPUTED] } } },
      },
    });

    for (const seller of sellers) {
      const totals = await this.dealsService.getSellerTotals(seller.id);
      const deals = await this.dealsService.listForSeller(seller.id);
      const liveStatuses: DealStatus[] = [DealStatus.PAID, DealStatus.SHIPPED, DealStatus.DISPUTED];
      const live = deals.filter((d) => liveStatuses.includes(d.status));

      const counts = live.reduce<Record<string, number>>((acc, d) => {
        acc[d.status] = (acc[d.status] ?? 0) + 1;
        return acc;
      }, {});

      const nearDeadline = live.filter(
        (d) => d.autoReleaseDeadline && d.autoReleaseDeadline.getTime() - Date.now() < 2 * 24 * 60 * 60 * 1000,
      ).length;

      const message = await this.aiService.draftDigest({
        totalInEscrow: Number(totals.totalInEscrow),
        counts,
        nearDeadline,
      });

      await this.telegramService.sendMessage(seller.telegramId!, message);
      await this.prisma.notificationLog.create({
        data: {
          sellerId: seller.id,
          type: 'DAILY_DIGEST',
          channel: 'TELEGRAM',
          payload: { totals, counts, nearDeadline },
        },
      });
    }

    this.logger.log(`Sent daily digest to ${sellers.length} sellers`);
  }

  /**
   * Runs hourly. For shipped deals nearing their deadline, sends a
   * "did you receive this?" prompt; for deals past deadline, auto-releases.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkDeadlines() {
    const pastDeadline = await this.dealsService.findPastDeadline();
    for (const deal of pastDeadline) {
      await this.dealsService.autoRelease(deal.id);
      if (deal.buyerTelegramId) {
        await this.telegramService.sendMessage(
          deal.buyerTelegramId,
          `No response received, so payment for your order has been released to the seller.`,
        );
      }
    }
    if (pastDeadline.length) {
      this.logger.log(`Auto-released ${pastDeadline.length} deals past deadline`);
    }

    // TODO: also query deals approaching (but not past) their deadline and
    // send a "did you receive this? reply YES or NO" reminder — needs a
    // `reminder_sent_at` style flag to avoid re-pinging every hour.
  }
}
