import { Injectable } from '@nestjs/common';
import type { NotificationCount, NotificationPush } from '@balitrade/shared';
import { Subject } from 'rxjs';

export type NotificationEvent =
  | { userId: string; kind: 'created'; push: NotificationPush }
  | { userId: string; kind: 'count'; count: NotificationCount };

/** Lets NotificationsService tell the gateway what to push, without knowing about Socket.IO. */
@Injectable()
export class NotificationEvents {
  readonly stream = new Subject<NotificationEvent>();
}
