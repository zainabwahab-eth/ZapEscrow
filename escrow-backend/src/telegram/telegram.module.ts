import { Module, forwardRef } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { SellersModule } from '../sellers/sellers.module';
import { DealsModule } from '../deals/deals.module';
import { AiModule } from '../ai/ai.module';
import { EmailModule } from '../email/email.module';
import { StorageModule } from '../storage/storage.module';
import { MonnifyModule } from '../monnify/monnify.module';

@Module({
  imports: [
    forwardRef(() => SellersModule),
    forwardRef(() => DealsModule),
    AiModule,
    EmailModule,
    StorageModule,
    MonnifyModule,
  ],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
