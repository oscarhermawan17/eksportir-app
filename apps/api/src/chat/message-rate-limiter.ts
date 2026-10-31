import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CHAT_LIMITS } from '@balitrade/shared';

const WINDOW_MS = 60_000;

/**
 * Sliding window per user, kept in memory (one API instance, like the login throttle in `docs/SECURITY.md`).
 * Rejected attempts do not count, so waiting is enough to send again.
 */
@Injectable()
export class MessageRateLimiter {
  private readonly sent = new Map<string, number[]>();

  constructor(
    private readonly limit: number = CHAT_LIMITS.messagesPerMinute,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a message for `userId` or throws 429 when the user sent too many in the last minute. */
  consume(userId: string): void {
    const now = this.now();
    const recent = (this.sent.get(userId) ?? []).filter((time) => now - time < WINDOW_MS);
    if (recent.length >= this.limit) {
      this.sent.set(userId, recent);
      throw new HttpException('Too many messages. Please wait a moment.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.sent.set(userId, recent);
    // Forget users that went quiet so the map does not grow without bound.
    if (this.sent.size > 10_000) {
      for (const [id, times] of this.sent) {
        if (times.every((time) => now - time >= WINDOW_MS)) this.sent.delete(id);
      }
    }
  }
}
