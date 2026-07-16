import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { SellersService } from './sellers.service';

@Controller('sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Post('signup')
  signup(@Body() body: { email: string; password: string; businessName: string; phone?: string }) {
    return this.sellersService.signupOrClaim(body);
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
