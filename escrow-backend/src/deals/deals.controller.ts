import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealStatus } from '@prisma/client';

@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  // Called once the seller confirms the review screen — see project notes,
  // nothing before this point should have touched the database.
  @Post()
  create(@Body() dto: CreateDealDto) {
    return this.dealsService.create(dto);
  }

  @Get('seller/:sellerId')
  listForSeller(@Param('sellerId') sellerId: string, @Query('status') status?: DealStatus) {
    return this.dealsService.listForSeller(sellerId, status);
  }

  @Get('seller/:sellerId/totals')
  getTotals(@Param('sellerId') sellerId: string) {
    return this.dealsService.getSellerTotals(sellerId);
  }

  // Public buyer-facing checkout page — no auth, no seller-sensitive data.
  @Get(':id/public')
  getPublicDeal(@Param('id') id: string) {
    return this.dealsService.getPublicDealView(id);
  }

  @Patch(':id/ship')
  markShipped(@Param('id') id: string, @Body('estimatedDeliveryDate') eta?: string) {
    return this.dealsService.markShipped(id, eta ? new Date(eta) : undefined);
  }

  // Buyer confirms via the checkout page or a Telegram reply — no auth,
  // buyer is intentionally accountless.
  @Patch(':id/confirm-delivery')
  confirmDelivery(@Param('id') id: string) {
    return this.dealsService.confirmDelivery(id);
  }

  @Patch(':id/dispute')
  raiseDispute(@Param('id') id: string, @Body() body: { reason: string; evidenceUrl?: string }) {
    return this.dealsService.raiseDispute(id, body.reason, body.evidenceUrl);
  }

  // Admin-only in practice — lock this down with auth before going beyond the demo.
  @Patch(':id/resolve-dispute')
  resolveDispute(@Param('id') id: string, @Body('resolution') resolution: 'RELEASED' | 'REFUNDED') {
    return this.dealsService.resolveDispute(id, resolution);
  }
}
