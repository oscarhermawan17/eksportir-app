import { BadRequestException } from '@nestjs/common';
import { isUsdtAddressFor, usdtAddressFamily } from '@balitrade/shared';
import { describe, expect, it } from 'vitest';
import { PaymentSettingsService } from './payment-settings.service.js';

const ENV: Record<string, string> = {
  PAY_BANK_NAME: 'BCA',
  PAY_BANK_ACCOUNT_NUMBER: '1234567890',
  PAY_BANK_ACCOUNT_HOLDER: 'PT BaliTrade Mock',
  PAY_USDT_NETWORK: 'TRC20',
  PAY_USDT_ADDRESS: 'TMockUsdtAddressForDevelopmentOnly00',
  PAY_EXCHANGE_NAME: 'Mock Exchange',
  PAY_EXCHANGE_CONTACT: '@mock',
  PAY_EXCHANGE_INSTRUCTIONS: 'Tell them the order number.',
  PAY_MOCK: 'true',
};

const ROW = {
  id: 'default',
  bankEnabled: true,
  bankName: 'Mandiri',
  bankAccountNumber: '9876543210',
  bankAccountHolder: 'PT BaliTrade',
  usdtEnabled: true,
  usdtNetwork: 'ERC20',
  usdtAddress: '0x' + 'a'.repeat(40),
  showTestWarning: false,
  updatedById: null,
  updatedAt: new Date(),
};

/** The service with a fake database row (or none) and fake env values. */
const service = (row: typeof ROW | null, env: Record<string, string> = ENV) =>
  new PaymentSettingsService(
    { paymentSettings: { findUnique: async () => row } } as never,
    {} as never,
    { get: (key: string) => env[key] } as never,
  );

describe('PaymentSettingsService.instructions', () => {
  it('uses the env values until the OWNER saves once', async () => {
    const now = await service(null).instructions();
    expect(now.bank).toEqual({ name: 'BCA', accountNumber: '1234567890', accountHolder: 'PT BaliTrade Mock' });
    expect(now.usdt).toEqual({ network: 'TRC20', address: 'TMockUsdtAddressForDevelopmentOnly00' });
    expect(now.mock).toBe(true);
  });

  it('uses the saved settings for bank and USDT once they exist; the exchange stays in env', async () => {
    const now = await service(ROW).instructions();
    expect(now.bank?.accountNumber).toBe('9876543210');
    expect(now.usdt).toEqual({ network: 'ERC20', address: ROW.usdtAddress });
    expect(now.exchange?.name).toBe('Mock Exchange');
  });

  it('hides a switched-off method', async () => {
    const now = await service({ ...ROW, bankEnabled: false, usdtEnabled: false }).instructions();
    expect(now.bank).toBeNull();
    expect(now.usdt).toBeNull();
  });

  it('warns while the OWNER says so, or while the env exchange is still a placeholder', async () => {
    expect((await service({ ...ROW, showTestWarning: true }).instructions()).mock).toBe(true);
    expect((await service(ROW).instructions()).mock).toBe(true); // env exchange offered with PAY_MOCK=true
    const noExchange = { ...ENV, PAY_EXCHANGE_NAME: '' };
    expect((await service(ROW, noExchange).instructions()).mock).toBe(false);
  });

  it('records where a payment went, and refuses a method that is not offered', async () => {
    expect(await service(ROW).destinationFor('BANK_IDR')).toBe('Mandiri 9876543210 a.n. PT BaliTrade');
    expect(await service(ROW).destinationFor('USDT')).toBe(`USDT ERC20 ${ROW.usdtAddress}`);
    expect(await service(ROW).destinationFor('EXCHANGE')).toBeNull();
    await expect(service({ ...ROW, bankEnabled: false }).destinationFor('BANK_IDR')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('isUsdtAddressFor', () => {
  it('accepts each network\'s own address shape only', () => {
    const tron = 'T' + '9'.repeat(33);
    const evm = '0x' + 'aB'.repeat(20);
    expect(isUsdtAddressFor('TRC20', tron)).toBe(true);
    expect(isUsdtAddressFor('TRC20', evm)).toBe(false);
    expect(isUsdtAddressFor('ERC20', evm)).toBe(true);
    expect(isUsdtAddressFor('BEP20', evm)).toBe(true);
    expect(isUsdtAddressFor('ERC20', tron)).toBe(false);
    // Base58 has no 0, O, I or l; a cut-off address is too short.
    expect(isUsdtAddressFor('TRC20', 'T' + '0'.repeat(33))).toBe(false);
    expect(isUsdtAddressFor('ERC20', '0x' + 'a'.repeat(39))).toBe(false);
  });
});

describe('usdtAddressFamily', () => {
  it('names the network family an address belongs to, so the OWNER can be told which network to pick', () => {
    expect(usdtAddressFamily('T' + '9'.repeat(33))).toBe('TRC20');
    expect(usdtAddressFamily('0x' + 'aB'.repeat(20))).toBe('EVM');
    expect(usdtAddressFamily('TMockUsdtAddressForDevelopmentOnly00')).toBeNull();
  });
});

describe('PaymentSettingsService.adminView before the first save', () => {
  it('leaves out an env address that is not a real one, so the first save does not fail on it', async () => {
    const svc = new PaymentSettingsService(
      { paymentSettings: { findUnique: async () => null } } as never,
      {} as never,
      { get: (key: string) => ENV[key] } as never,
    );
    const view = await svc.adminView();
    expect(view.saved).toBe(false);
    expect(view.usdtAddress).toBe('');
    expect(view.usdtEnabled).toBe(false);
    expect(view.bankAccountNumber).toBe('1234567890');
  });
});
