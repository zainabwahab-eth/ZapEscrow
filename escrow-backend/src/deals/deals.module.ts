import { Module, forwardRef } from '@nestjs/common';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { MonnifyModule } from '../monnify/monnify.module';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    forwardRef(() => MonnifyModule),
    forwardRef(() => TelegramModule),
    NotificationsModule,
    EmailModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [DealsController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}
