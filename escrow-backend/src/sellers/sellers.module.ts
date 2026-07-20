import { Module, forwardRef } from '@nestjs/common';
import { SellersService } from './sellers.service';
import { SellersController } from './sellers.controller';
import { AuthModule } from '../auth/auth.module';
import { DealsModule } from '../deals/deals.module';

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => DealsModule)],
  controllers: [SellersController],
  providers: [SellersService],
  exports: [SellersService],
})
export class SellersModule {}
