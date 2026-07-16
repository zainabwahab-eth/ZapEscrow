import { BadRequestException, Body, Controller, Headers, Logger, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DealsService } from '../deals/deals.service';

/**
 * Monnify webhook receiver. Two things matter most here:
 * 1. Validate the monnify-signature header before trusting the payload.
 * 2. Be idempotent — Monnify may deliver the same event more than once,
 *    so we check webhook_events before acting on a transactionReference.
 */
@Controller('webhooks/monnify')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dealsService: DealsService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async handle(@Body() body: any, @Headers('monnify-signature') signature: string) {
    this.logger.log(`Webhook received: eventType=${body.eventType}, ref=${body.eventData?.transactionReference}`);

    this.verifySignature(body, signature);

    const eventType = body.eventType; // e.g. "SUCCESSFUL_TRANSACTION"
    const transactionReference = body.eventData?.transactionReference;

    if (!transactionReference) {
      throw new BadRequestException('Missing transactionReference in webhook payload');
    }

    const existing = await this.prisma.webhookEvent.findUnique({
      where: { transactionReference_eventType: { transactionReference, eventType } },
    });
    if (existing?.processed) {
      return { received: true, duplicate: true };
    }

    const event = await this.prisma.webhookEvent.upsert({
      where: { transactionReference_eventType: { transactionReference, eventType } },
      create: { eventType, transactionReference, payload: body },
      update: { payload: body },
    });

    if (eventType === 'SUCCESSFUL_TRANSACTION') {
      const deal = await this.prisma.deal.findUnique({ where: { transactionReference } });
      if (deal) {
        await this.dealsService.markPaid(deal.id);
      }
    }

    // TODO: handle EXPIRED, FAILED, and disbursement/settlement event types
    // as those flows get built out.

    await this.prisma.webhookEvent.update({ where: { id: event.id }, data: { processed: true } });
    return { received: true };
  }

  private verifySignature(body: any, signature: string) {
    const secret = this.config.get<string>('MONNIFY_SECRET_KEY');
    if (!secret) return; // allow through in early local dev before secret is configured

    const expected = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    if (expected !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }
  }
}
