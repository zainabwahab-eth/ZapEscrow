import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MonnifyService } from './monnify.service';

@Module({
  imports: [HttpModule],
  providers: [MonnifyService],
  exports: [MonnifyService],
})
export class MonnifyModule {}
