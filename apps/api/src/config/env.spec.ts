import { validateEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
};
const r2 = {
  R2_ACCOUNT_ID: 'acc',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_PUBLIC_BUCKET: 'pub',
  R2_PRIVATE_BUCKET: 'priv',
  R2_PUBLIC_BASE_URL: 'https://pub.example.com',
};

describe('validateEnv — R2', () => {
  it('allows development without any R2 setting', () => {
    expect(validateEnv({ ...base, R2_ACCOUNT_ID: '' }).R2_ACCOUNT_ID).toBeUndefined();
  });

  it('accepts a complete R2 configuration', () => {
    expect(validateEnv({ ...base, ...r2 }).R2_PUBLIC_BUCKET).toBe('pub');
  });

  it('rejects a partly configured R2 (a typo would otherwise silently disable uploads)', () => {
    expect(() => validateEnv({ ...base, R2_ACCOUNT_ID: 'acc', R2_ACCESS_KEY_ID: 'key' })).toThrow(/partly configured/);
  });

  it('requires R2 in production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/Missing R2 settings/);
    expect(validateEnv({ ...base, ...r2, NODE_ENV: 'production' }).NODE_ENV).toBe('production');
  });

  it('requires a http(s) public base URL', () => {
    expect(() => validateEnv({ ...base, ...r2, R2_PUBLIC_BASE_URL: 'pub.example.com' })).toThrow(/http/);
  });
});
