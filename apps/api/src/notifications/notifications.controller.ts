import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser, NotificationCount, NotificationsResponse, NotificationView } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { NotificationsService } from './notifications.service.js';

/** A user only ever sees and changes their own notifications. */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<NotificationsResponse> {
    return this.notifications.list(user);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: AuthUser): Promise<NotificationCount> {
    return this.notifications.markAllRead(user);
  }

  @Post('conversations/:conversationId/read')
  readConversation(@CurrentUser() user: AuthUser, @Param('conversationId') conversationId: string): Promise<NotificationCount> {
    return this.notifications.markConversationRead(user, conversationId);
  }

  @Post(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<NotificationView> {
    return this.notifications.markRead(user, id);
  }
}
