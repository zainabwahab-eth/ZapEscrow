import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealStatus } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  // Called once the seller confirms the review screen — see project notes,
  // nothing before this point should have touched the database.
  @Post()
  create(@Body() dto: CreateDealDto) {
    return this.dealsService.create(dto);
  }

  // Dashboard dispute queue — any valid seller JWT for now, no separate admin role yet.
  @Get('disputes')
  @UseGuards(JwtAuthGuard)
  listDisputes() {
    return this.dealsService.listDisputes();
  }

  @Get('seller/:sellerId')
  listForSeller(@Param('sellerId') sellerId: string, @Query('status') status?: DealStatus) {
    return this.dealsService.listForSeller(sellerId, status);
  }

  @Get('seller/:sellerId/totals')
  getTotals(@Param('sellerId') sellerId: string) {
    return this.dealsService.getSellerTotals(sellerId);
  }

  // Public buyer-facing status page — no auth, no seller-sensitive data.
  // Revisitable: also carries status/shippedAt/ETA/deadline so the frontend
  // can render the right UI whether the buyer is paying, waiting, or deciding
  // whether to confirm/dispute.
  @Get(':id/public')
  getPublicDeal(@Param('id') id: string) {
    return this.dealsService.getPublicDealView(id);
  }

  // Buyer-facing confirm/dispute actions from the public status page — no
  // seller/buyer account, so the buyer is authenticated by possession of
  // deal.confirmationToken instead. That token is only ever handed to
  // whoever completes payment (via the Monnify redirect) or receives the
  // shipped/reminder emails — never shown on the seller's plain shareable
  // link — so a seller can't self-confirm their own deal.
  @Post(':id/public/confirm')
  confirmPublic(@Param('id') id: string, @Query('token') token: string) {
    return this.dealsService.confirmDelivery(id, token);
  }

  @Post(':id/public/dispute')
  disputePublic(@Param('id') id: string, @Query('token') token: string, @Body() body: { reason: string }) {
    return this.dealsService.raiseDispute(id, token, body.reason);
  }

  @Patch(':id/ship')
  markShipped(@Param('id') id: string, @Body('estimatedDeliveryDate') eta?: string) {
    return this.dealsService.markShipped(id, eta ? new Date(eta) : undefined);
  }

  @Patch(':id/resolve-dispute')
  @UseGuards(JwtAuthGuard, AdminGuard)
  resolveDispute(@Param('id') id: string, @Body('resolution') resolution: 'RELEASED' | 'REFUNDED') {
    return this.dealsService.resolveDispute(id, resolution);
  }
}
