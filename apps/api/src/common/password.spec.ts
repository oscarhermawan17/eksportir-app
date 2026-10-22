import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('verifies the correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('scrypt$')).toBe(true);
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password and malformed hashes', async () => {
    const hash = await hashPassword('secret-1');
    await expect(verifyPassword('secret-2', hash)).resolves.toBe(false);
    await expect(verifyPassword('secret-1', 'not-a-hash')).resolves.toBe(false);
  });
});
