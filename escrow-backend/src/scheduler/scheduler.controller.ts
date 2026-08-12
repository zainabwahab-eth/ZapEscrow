import { Controller, Post, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerService } from './scheduler.service';

@Controller('internal/scheduler')
export class SchedulerController {
  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly config: ConfigService,
  ) {}

  private verifySecret(secret: string) {
    if (secret !== this.config.get<string>('SCHEDULER_SECRET')) {
      throw new UnauthorizedException('Invalid scheduler secret');
    }
  }

  @Post('daily-digest')
  async runDigest(@Headers('x-scheduler-secret') secret: string) {
    this.verifySecret(secret);
    await this.schedulerService.sendDailyDigests();
    return { ok: true };
  }

  @Post('check-deadlines')
  async runDeadlineCheck(@Headers('x-scheduler-secret') secret: string) {
    this.verifySecret(secret);
    await this.schedulerService.checkDeadlines();
    return { ok: true };
  }
}
