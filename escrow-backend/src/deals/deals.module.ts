import { Module, forwardRef } from '@nestjs/common';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { MonnifyModule } from '../monnify/monnify.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [MonnifyModule, forwardRef(() => TelegramModule)],
  controllers: [DealsController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}
