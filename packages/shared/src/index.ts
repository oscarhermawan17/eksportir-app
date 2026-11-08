export * from './roles.js';
export * from './locales.js';
export * from './auth.js';
export * from './seller.js';
export * from './media.js';
export * from './product.js';
export * from './fx.js';
export * from './chat.js';
export * from './notifications.js';
export * from './orders.js';
export * from './payments.js';

/** Response shape of GET /api/health. */
export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'up' | 'down';
  timestamp: string;
}
