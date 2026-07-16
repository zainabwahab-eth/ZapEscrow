import { Module, forwardRef } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { SellersModule } from '../sellers/sellers.module';
import { DealsModule } from '../deals/deals.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [SellersModule, forwardRef(() => DealsModule), AiModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
