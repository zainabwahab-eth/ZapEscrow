import { Controller, Get, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Req() req: any, @Query('unreadOnly') unreadOnly?: string) {
    return this.notificationsService.listForSeller(req.sellerId, unreadOnly === 'true');
  }

  @Patch('read-all')
  markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.sellerId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }
}
