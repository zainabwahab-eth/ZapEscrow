import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, NotificationChannel, Prisma } from '../generated/prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    sellerId: string;
    type: NotificationType;
    channel: NotificationChannel;
    payload?: Prisma.InputJsonValue;
  }) {
    return this.prisma.notificationLog.create({ data });
  }

  async listForSeller(sellerId: string, unreadOnly = false) {
    return this.prisma.notificationLog.findMany({
      where: { sellerId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string) {
    return this.prisma.notificationLog.update({ where: { id }, data: { read: true } });
  }

  async markAllRead(sellerId: string) {
    return this.prisma.notificationLog.updateMany({ where: { sellerId, read: false }, data: { read: true } });
  }
}
