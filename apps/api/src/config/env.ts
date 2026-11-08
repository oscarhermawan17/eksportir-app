/**
 * Validates environment variables at startup so a misconfigured server fails fast.
 */
export interface Env {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  WEB_ORIGIN: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN_SECONDS: number;
  /** Cloudflare R2. Optional in development (media endpoints answer 503 until set); required in production. */
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  /** Bucket with public read access (product photos/videos). */
  R2_PUBLIC_BUCKET?: string;
  /** Base URL that serves R2_PUBLIC_BUCKET, e.g. https://pub-xxxx.r2.dev or https://media.example.com */
  R2_PUBLIC_BASE_URL?: string;
  /** Private bucket (payment proofs, QC reports, chat files); read only via short-lived signed URLs. */
  R2_PRIVATE_BUCKET?: string;
  /**
   * Where buyers send their money (T17). Never in code: these are account details that change, and
   * development runs on mock values. A method whose fields are empty is hidden from the payment page,
   * so a half-filled `.env` cannot show a buyer an incomplete instruction.
   */
  PAY_BANK_NAME?: string;
  PAY_BANK_ACCOUNT_NUMBER?: string;
  PAY_BANK_ACCOUNT_HOLDER?: string;
  /** TRC20 | ERC20 | BEP20 ... shown to the buyer verbatim: the wrong network loses their funds. */
  PAY_USDT_NETWORK?: string;
  PAY_USDT_ADDRESS?: string;
  PAY_EXCHANGE_NAME?: string;
  PAY_EXCHANGE_CONTACT?: string;
  /** Free text shown to the buyer, e.g. what to say to the exchange and which reference to ask for. */
  PAY_EXCHANGE_INSTRUCTIONS?: string;
  /** Set to `true` while the three above hold development placeholders; the payment page then says so. */
  PAY_MOCK?: string;
}

const R2_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_PUBLIC_BUCKET',
  'R2_PUBLIC_BASE_URL',
  'R2_PRIVATE_BUCKET',
] as const;

const PAY_KEYS = [
  'PAY_BANK_NAME',
  'PAY_BANK_ACCOUNT_NUMBER',
  'PAY_BANK_ACCOUNT_HOLDER',
  'PAY_USDT_NETWORK',
  'PAY_USDT_ADDRESS',
  'PAY_EXCHANGE_NAME',
  'PAY_EXCHANGE_CONTACT',
  'PAY_EXCHANGE_INSTRUCTIONS',
  'PAY_MOCK',
] as const;

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

  const jwtSecret = config.JWT_SECRET;
  if (typeof jwtSecret !== 'string' || jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }

  const jwtExpiresIn = Number(config.JWT_EXPIRES_IN_SECONDS ?? 60 * 60 * 24 * 7);
  if (!Number.isInteger(jwtExpiresIn) || jwtExpiresIn <= 0) {
    errors.push('JWT_EXPIRES_IN_SECONDS must be a positive integer');
  }

  const r2: Partial<Record<(typeof R2_KEYS)[number], string>> = {};
  for (const key of R2_KEYS) {
    const value = config[key];
    if (typeof value === 'string' && value.trim() !== '') {
      r2[key] = value.trim();
    }
  }
  const r2Missing = R2_KEYS.filter((key) => r2[key] === undefined);
  if (nodeEnv === 'production' && r2Missing.length > 0) {
    errors.push(`Missing R2 settings: ${r2Missing.join(', ')}`);
  } else if (r2Missing.length > 0 && r2Missing.length < R2_KEYS.length) {
    errors.push(`R2 is partly configured, missing: ${r2Missing.join(', ')}`);
  }
  if (r2.R2_PUBLIC_BASE_URL && !/^https?:\/\//.test(r2.R2_PUBLIC_BASE_URL)) {
    errors.push('R2_PUBLIC_BASE_URL must start with http:// or https://');
  }

  // Payment details are optional: an unconfigured method is simply not offered (see the Env comment).
  const pay: Partial<Record<(typeof PAY_KEYS)[number], string>> = {};
  for (const key of PAY_KEYS) {
    const value = config[key];
    if (typeof value === 'string' && value.trim() !== '') {
      pay[key] = value.trim();
    }
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
    JWT_SECRET: jwtSecret as string,
    JWT_EXPIRES_IN_SECONDS: jwtExpiresIn,
    ...r2,
    ...pay,
  };
}
