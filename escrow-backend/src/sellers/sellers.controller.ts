import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { SellersService } from './sellers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Post('signup')
  signup(@Body() body: { email: string; password: string; businessName: string; phone?: string }) {
    return this.sellersService.signupOrClaim(body);
  }

  // Used by the frontend to check onboarding status — if businessName is
  // empty, the seller signed up but hasn't finished onboarding yet.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return this.sellersService.getProfile(req.sellerId);
  }

  @Patch('onboarding')
  @UseGuards(JwtAuthGuard)
  onboarding(@Req() req: any, @Body() body: { businessName: string; phone: string; salesChannels: string[] }) {
    return this.sellersService
      .updateOnboarding(req.sellerId, body)
      .then((seller) => this.sellersService.toPublic(seller));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sellersService.findById(id);
  }

  @Patch(':id/settlement-account')
  updateSettlement(@Param('id') id: string, @Body() body: { accountNumber: string; bankCode: string }) {
    return this.sellersService.updateSettlementAccount(id, body.accountNumber, body.bankCode);
  }
}
