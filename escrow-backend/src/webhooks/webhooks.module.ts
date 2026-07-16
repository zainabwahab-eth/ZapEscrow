import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { DealsModule } from '../deals/deals.module';

@Module({
  imports: [DealsModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
