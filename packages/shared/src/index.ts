export * from './roles.js';
export * from './locales.js';

/** Response shape of GET /api/health. */
export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'up' | 'down';
  timestamp: string;
}
