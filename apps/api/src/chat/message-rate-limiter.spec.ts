import { HttpException } from '@nestjs/common';
import { MessageRateLimiter } from './message-rate-limiter.js';

describe('MessageRateLimiter', () => {
  it('allows up to the limit and then answers 429', () => {
    let now = 1_000;
    const limiter = new MessageRateLimiter(3, () => now);
    for (let i = 0; i < 3; i++) limiter.consume('a');
    expect(() => limiter.consume('a')).toThrow(HttpException);
    try {
      limiter.consume('a');
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });

  it('counts per user', () => {
    const limiter = new MessageRateLimiter(1, () => 1_000);
    limiter.consume('a');
    expect(() => limiter.consume('b')).not.toThrow();
    expect(() => limiter.consume('a')).toThrow(HttpException);
  });

  it('supports another window and message (used for order requests per hour)', () => {
    let now = 0;
    const limiter = new MessageRateLimiter(1, () => now, 3_600_000, 'Too many order requests.');
    limiter.consume('a');
    now = 59 * 60_000; // still inside the hour
    expect(() => limiter.consume('a')).toThrow('Too many order requests.');
    now = 3_600_001;
    expect(() => limiter.consume('a')).not.toThrow();
  });

  it('frees a slot after a minute, and rejected attempts do not extend the wait', () => {
    let now = 0;
    const limiter = new MessageRateLimiter(2, () => now);
    limiter.consume('a'); // t = 0
    now = 30_000;
    limiter.consume('a'); // t = 30 s
    now = 59_000;
    expect(() => limiter.consume('a')).toThrow(); // rejected, not recorded
    now = 60_001; // the first message left the window
    expect(() => limiter.consume('a')).not.toThrow();
    expect(() => limiter.consume('a')).toThrow(); // 30 s and 60.001 s are inside the window
  });
});
