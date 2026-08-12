import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SellersModule } from './sellers/sellers.module';
import { DealsModule } from './deals/deals.module';
import { MonnifyModule } from './monnify/monnify.module';
import { TelegramModule } from './telegram/telegram.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AiModule } from './ai/ai.module';
import { EmailModule } from './email/email.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SellersModule,
    DealsModule,
    MonnifyModule,
    TelegramModule,
    WebhooksModule,
    SchedulerModule,
    AiModule,
    EmailModule,
    StorageModule,
    AuthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
