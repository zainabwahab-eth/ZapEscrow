import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SellersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Telegram signup — email anchors the account, no password yet. */
  async createFromTelegram(params: {
    email: string;
    businessName: string;
    phone?: string;
    telegramId: string;
  }) {
    const existing = await this.prisma.seller.findUnique({ where: { email: params.email } });
    if (existing) {
      // Already exists (e.g. created via web first) — just link the telegramId.
      return this.prisma.seller.update({
        where: { email: params.email },
        data: { telegramId: params.telegramId },
      });
    }

    return this.prisma.seller.create({ data: params });
  }

  /**
   * Web signup/"claim" — if a seller already exists from Telegram (same
   * email, no password yet), this sets their password instead of creating
   * a duplicate account.
   */
  async signupOrClaim(params: { email: string; password: string; businessName: string; phone?: string }) {
    const existing = await this.prisma.seller.findUnique({ where: { email: params.email } });
    const passwordHash = await bcrypt.hash(params.password, 10);

    if (existing) {
      if (existing.passwordHash) {
        throw new ConflictException('An account with this email already has a password set — log in instead');
      }
      return this.prisma.seller.update({
        where: { email: params.email },
        data: { passwordHash },
      });
    }

    return this.prisma.seller.create({
      data: { email: params.email, businessName: params.businessName, phone: params.phone, passwordHash },
    });
  }

  async findById(id: string) {
    const seller = await this.prisma.seller.findUnique({ where: { id } });
    if (!seller) throw new NotFoundException('Seller not found');
    return seller;
  }

  async findByTelegramId(telegramId: string) {
    return this.prisma.seller.findUnique({ where: { telegramId } });
  }

  async updateSettlementAccount(id: string, accountNumber: string, bankCode: string) {
    return this.prisma.seller.update({
      where: { id },
      data: { monnifySettlementAccount: accountNumber, monnifySettlementBankCode: bankCode },
    });
  }
}
