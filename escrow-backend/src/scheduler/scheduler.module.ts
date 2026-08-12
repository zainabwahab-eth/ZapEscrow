import { Module } from '@nestjs/common';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { DealsModule } from '../deals/deals.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [DealsModule, TelegramModule, AiModule],
  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class SchedulerModule {}
