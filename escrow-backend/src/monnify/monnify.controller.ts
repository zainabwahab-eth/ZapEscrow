import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MonnifyService } from './monnify.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('monnify')
export class MonnifyController {
  constructor(private readonly monnifyService: MonnifyService) {}

  // Used by the Settings page to resolve an account name before a seller
  // confirms their disbursement account — mirrors the Telegram /bank flow.
  @Get('name-enquiry')
  @UseGuards(JwtAuthGuard)
  async nameEnquiry(@Query('account') account: string, @Query('bank') bank: string) {
    const result = await this.monnifyService.nameEnquiry(account, bank);
    return { accountName: result?.responseBody?.accountName ?? null };
  }

  // Populates the Settings page's bank dropdown with the real supported list.
  @Get('banks')
  @UseGuards(JwtAuthGuard)
  getBanks() {
    return this.monnifyService.getBanks();
  }
}
