/**
 * Validates environment variables at startup so a misconfigured server fails fast.
 */
export interface Env {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  WEB_ORIGIN: string;
  DATABASE_URL: string;
}

export function validateEnv(config: Record<string, unknown>): Env {
  const errors: string[] = [];

  const nodeEnv = String(config.NODE_ENV ?? 'development');
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    errors.push('NODE_ENV must be development, production or test');
  }

  const port = Number(config.PORT ?? 4000);
  if (!Number.isInteger(port) || port <= 0) {
    errors.push('PORT must be a positive integer');
  }

  const databaseUrl = config.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || !databaseUrl.startsWith('postgres')) {
    errors.push('DATABASE_URL must be a PostgreSQL connection string');
  }

  const webOrigin = String(config.WEB_ORIGIN ?? 'http://localhost:3000');

  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
  }

  return {
    NODE_ENV: nodeEnv as Env['NODE_ENV'],
    PORT: port,
    WEB_ORIGIN: webOrigin,
    DATABASE_URL: databaseUrl as string,
  };
}
