import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MonnifyService } from "../monnify/monnify.service";
import { TelegramService } from "../telegram/telegram.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateDealDto } from "./dto/create-deal.dto";
import { DealEventActor, DealStatus, Prisma } from "../generated/prisma/client";

// Buyer's confirmation window, counted from the estimated delivery date
// (or from the shipped date if no ETA was given) — mirrors Alipay/Taobao's
// pattern of counting from delivery, not from when the seller merely ships.
const AUTO_RELEASE_BUFFER_DAYS = 7;

@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly monnify: MonnifyService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Step after the seller confirms the review screen — creates the deal + Monnify checkout. */
  async create(dto: CreateDealDto) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: dto.sellerId },
    });
    if (!seller) throw new NotFoundException("Seller not found");

    const amount = dto.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    // Create the deal first (without Monnify refs) so we always have a
    // paymentReference to hand Monnify — deal id doubles as part of it.
    const deal = await this.createDealWithShortCode({
      sellerId: dto.sellerId,
      buyerName: dto.buyerName,
      buyerPhone: dto.buyerPhone,
      buyerEmail: dto.buyerEmail,
      buyerTelegramId: dto.buyerTelegramId,
      amount,
      paymentReference: `pending-${Date.now()}`, // placeholder, replaced below
      items: {
        create: dto.items.map((item) => ({
          name: item.name,
          imageUrl: item.imageUrl,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
      },
      events: {
        create: {
          toStatus: DealStatus.CREATED,
          actor: DealEventActor.SELLER,
          note: "Deal created, awaiting buyer payment",
        },
      },
    });
    this.logger.log(
      `Initializing Monnify transaction for deal ${deal.id}, amount ${amount}`,
    );

    const monnifyTx = await this.monnify.initializeTransaction({
      amount,
      buyerEmail: dto.buyerEmail ?? "",
      buyerName: dto.buyerName ?? dto.buyerPhone,
      dealId: deal.id,
    });

    this.logger.log(
      `Monnify transaction initialized: ${JSON.stringify(monnifyTx)}`,
    );

    return this.prisma.deal.update({
      where: { id: deal.id },
      data: {
        paymentReference: monnifyTx.paymentReference,
        transactionReference: monnifyTx.transactionReference,
        checkoutUrl: monnifyTx.checkoutUrl,
      },
      include: { items: true },
    });
  }

  /** Called by the webhook handler once Monnify confirms payment. */
  async markPaid(dealId: string) {
    const deal = await this.getOrThrow(dealId);
    if (deal.status !== DealStatus.CREATED) return deal; // idempotency guard

    await this.prisma.deal.update({ where: { id: dealId }, data: { paidAt: new Date() } });
    const updated = await this.transition(
      dealId,
      DealStatus.PAID,
      DealEventActor.SYSTEM,
      "Monnify confirmed payment",
    );

    const seller = await this.prisma.seller.findUnique({
      where: { id: deal.sellerId },
    });
    if (seller?.telegramId) {
      const buyerLabel = deal.buyerName || deal.buyerPhone;
      await this.telegramService.sendMessage(
        seller.telegramId,
        `💰 ${buyerLabel} just paid ₦${Number(deal.amount).toLocaleString()} — funds are now held in escrow. Once you've shipped the order, reply /ship ${deal.shortCode} with an estimated delivery date (e.g. '/ship ${deal.shortCode} 2026-07-20') so we can let the buyer know when to expect it.`,
      );
    }

    return updated;
  }

  /** Seller marks the item shipped — starts the auto-release clock. */
  async markShipped(dealId: string, estimatedDeliveryDate?: Date) {
    const deal = await this.getOrThrow(dealId);
    if (deal.status !== DealStatus.PAID) {
      throw new BadRequestException(
        "Deal must be PAID before it can be marked shipped",
      );
    }

    const baseDate = estimatedDeliveryDate ?? new Date();
    const deadline = new Date(baseDate);
    deadline.setDate(deadline.getDate() + AUTO_RELEASE_BUFFER_DAYS);

    await this.prisma.deal.update({
      where: { id: dealId },
      data: {
        shippedAt: new Date(),
        estimatedDeliveryDate,
        autoReleaseDeadline: deadline,
      },
    });

    return this.transition(
      dealId,
      DealStatus.SHIPPED,
      DealEventActor.SELLER,
      "Marked shipped",
    );
  }

  /** Buyer confirms receipt — triggers fund release. */
  async confirmDelivery(dealId: string) {
    const deal = await this.getOrThrow(dealId);
    if (deal.status !== DealStatus.SHIPPED) {
      throw new BadRequestException(
        "Deal must be SHIPPED before delivery can be confirmed",
      );
    }

    await this.prisma.deal.update({
      where: { id: dealId },
      data: { deliveredConfirmedAt: new Date() },
    });
    await this.transition(
      dealId,
      DealStatus.DELIVERED,
      DealEventActor.BUYER,
      "Buyer confirmed receipt",
    );

    return this.releaseFunds(dealId);
  }

  /** Buyer raises a dispute — freezes funds, creates the dispute record. */
  async raiseDispute(dealId: string, reason: string, evidenceUrl?: string) {
    const deal = await this.getOrThrow(dealId);
    if (deal.status !== DealStatus.SHIPPED) {
      throw new BadRequestException(
        "Disputes can only be raised on shipped deals",
      );
    }

    await this.prisma.dispute.create({
      data: { dealId, raisedBy: DealEventActor.BUYER, reason, evidenceUrl },
    });
    await this.prisma.deal.update({
      where: { id: dealId },
      data: { disputedAt: new Date() },
    });

    return this.transition(
      dealId,
      DealStatus.DISPUTED,
      DealEventActor.BUYER,
      `Dispute: ${reason}`,
    );
  }

  /** Admin resolves a dispute — either releases to seller or refunds buyer. */
  async resolveDispute(dealId: string, resolution: "RELEASED" | "REFUNDED") {
    const deal = await this.getOrThrow(dealId);
    if (deal.status !== DealStatus.DISPUTED) {
      throw new BadRequestException("Deal is not currently disputed");
    }

    await this.prisma.dispute.update({
      where: { dealId },
      data: { resolution, resolvedAt: new Date() },
    });

    if (resolution === "RELEASED") {
      await this.transition(
        dealId,
        DealStatus.DELIVERED,
        DealEventActor.ADMIN,
        "Dispute resolved — releasing to seller",
      );
      return this.releaseFunds(dealId);
    }

    await this.transition(
      dealId,
      DealStatus.REFUNDED,
      DealEventActor.ADMIN,
      "Dispute resolved — refunding buyer",
    );
    // TODO: wire actual Monnify refund call here once refund flow is scoped
    return this.getOrThrow(dealId);
  }

  /** Called by the scheduler for deals past their auto-release deadline with no buyer response. */
  async autoRelease(dealId: string) {
    const deal = await this.getOrThrow(dealId);
    if (deal.status !== DealStatus.SHIPPED) return deal; // already resolved

    await this.transition(
      dealId,
      DealStatus.AUTO_RELEASED,
      DealEventActor.SYSTEM,
      `No buyer response within ${AUTO_RELEASE_BUFFER_DAYS} days of the delivery window — auto-released`,
    );
    return this.releaseFunds(dealId);
  }

  /** Fires the actual Monnify disbursement and records it. */
  private async releaseFunds(dealId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { seller: true },
    });
    if (!deal) throw new NotFoundException("Deal not found");

    if (!deal.seller.monnifySettlementAccount || !deal.seller.monnifySettlementBankCode) {
      // Can't disburse yet — record it as pending and notify the seller
      // instead of attempting a broken Monnify call with empty fields.
      await this.prisma.disbursement.create({
        data: {
          dealId,
          monnifyReference: `pending-${dealId}`,
          amount: deal.amount,
          status: "PENDING",
        },
      });
      await this.notificationsService.create({
        sellerId: deal.sellerId,
        type: "DISBURSEMENT_MISSING",
        channel: "IN_APP",
        payload: { dealId, amount: deal.amount.toString() },
      });
      if (deal.seller.telegramId) {
        await this.telegramService.sendMessage(
          deal.seller.telegramId,
          `💸 ₦${Number(deal.amount).toLocaleString()} is ready to release, but you haven't added a disbursement account yet. Reply /bank to add one — I'll release it as soon as it's set up.`,
        );
      }
      return this.transition(
        dealId,
        DealStatus.RELEASED,
        DealEventActor.SYSTEM,
        "Release blocked — no settlement account on file",
      );
    }

    const transfer = await this.monnify.releaseSingleTransfer({
      amount: Number(deal.amount),
      destinationAccountNumber: deal.seller.monnifySettlementAccount,
      destinationBankCode: deal.seller.monnifySettlementBankCode,
      destinationAccountName: deal.seller.businessName,
      dealId: deal.id,
    });

    await this.prisma.disbursement.create({
      data: {
        dealId,
        monnifyReference: transfer.reference,
        amount: deal.amount,
        status: transfer.status === "SUCCESS" ? "COMPLETED" : "PENDING",
        completedAt: transfer.status === "SUCCESS" ? new Date() : null,
      },
    });

    await this.notificationsService.create({
      sellerId: deal.sellerId,
      type: "FUNDS_RELEASED",
      channel: "IN_APP",
      payload: { dealId, amount: deal.amount.toString() },
    });

    return this.transition(
      dealId,
      DealStatus.RELEASED,
      DealEventActor.SYSTEM,
      "Funds disbursed to seller",
    );
  }

  /** Retries any releases that were blocked on a missing settlement account, e.g. right after the seller adds one. */
  async retryPendingDisbursementsForSeller(sellerId: string) {
    const pending = await this.prisma.disbursement.findMany({
      where: { status: "PENDING", deal: { sellerId } },
      include: { deal: true },
    });
    for (const d of pending) {
      if (d.monnifyReference.startsWith("pending-")) {
        await this.prisma.disbursement.delete({ where: { id: d.id } });
        await this.releaseFunds(d.dealId);
      }
    }
  }

  private async transition(
    dealId: string,
    toStatus: DealStatus,
    actor: DealEventActor,
    note: string,
  ) {
    const current = await this.getOrThrow(dealId);
    await this.prisma.dealEvent.create({
      data: { dealId, fromStatus: current.status, toStatus, actor, note },
    });
    return this.prisma.deal.update({
      where: { id: dealId },
      data: { status: toStatus },
    });
  }

  private async getOrThrow(dealId: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new NotFoundException("Deal not found");
    return deal;
  }

  /** Looks up a deal by its human-friendly code (e.g. from a /ship command). */
  async findByShortCode(shortCode: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { shortCode: shortCode.toUpperCase() },
    });
    if (!deal) throw new NotFoundException(`No deal found with code ${shortCode}`);
    return deal;
  }

  /** Creates a deal record with a unique shortCode, retrying on the rare collision. */
  private async createDealWithShortCode(
    data: Omit<Prisma.DealUncheckedCreateInput, "shortCode">,
  ) {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.deal.create({
          data: { ...data, shortCode: this.generateShortCode() },
        });
      } catch (err) {
        const isShortCodeCollision =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          (err.meta?.target as string[] | undefined)?.includes("shortCode");
        if (!isShortCodeCollision || attempt === MAX_ATTEMPTS) throw err;
      }
    }
    throw new Error("Failed to generate a unique short code");
  }

  /** 6-char uppercase code, ambiguous characters excluded, for buyer/seller-facing references. */
  private generateShortCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  /** Dashboard: filterable deal list for a seller. */
  async listForSeller(sellerId: string, status?: DealStatus) {
    return this.prisma.deal.findMany({
      where: { sellerId, ...(status ? { status } : {}) },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Dashboard: escrow totals. */
  async getSellerTotals(sellerId: string) {
    const [inEscrow, released, refunded] = await Promise.all([
      this.prisma.deal.aggregate({
        where: {
          sellerId,
          status: {
            in: [DealStatus.PAID, DealStatus.SHIPPED, DealStatus.DISPUTED],
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.disbursement.aggregate({
        where: { deal: { sellerId }, status: "COMPLETED" },
        _sum: { amount: true },
      }),
      this.prisma.deal.aggregate({
        where: { sellerId, status: DealStatus.REFUNDED },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalInEscrow: inEscrow._sum.amount ?? 0,
      totalReleased: released._sum.amount ?? 0,
      totalRefunded: refunded._sum.amount ?? 0,
    };
  }

  /** Used by the scheduler to find deals to nudge or auto-release. */
  async findPastDeadline() {
    return this.prisma.deal.findMany({
      where: {
        status: DealStatus.SHIPPED,
        autoReleaseDeadline: { lte: new Date() },
      },
    });
  }

  /** Public buyer-facing checkout page — no seller-sensitive data included. */
  async getPublicDealView(dealId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        items: true,
        seller: { select: { businessName: true, verifiedBadge: true } },
      },
    });
    if (!deal) throw new NotFoundException("Deal not found");

    return {
      id: deal.id,
      sellerName: deal.seller.businessName,
      sellerVerified: deal.seller.verifiedBadge,
      buyerName: deal.buyerName,
      amount: deal.amount,
      status: deal.status,
      checkoutUrl: deal.checkoutUrl,
      items: deal.items.map((i) => ({
        name: i.name,
        imageUrl: i.imageUrl,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
      })),
    };
  }
}
