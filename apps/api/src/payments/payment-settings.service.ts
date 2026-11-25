import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { USDT_NETWORKS, maskAccount } from '@balitrade/shared';
import type { AdminPaymentSettingsView, PaymentInstructions, PaymentMethod, UsdtNetwork } from '@balitrade/shared';
import { AuditService } from '../audit/audit.service.js';
import type { Env } from '../config/env.js';
import type { PaymentSettings } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaymentSettingsDto } from './dto/payment-settings.dto.js';

const ID = 'default';

/** An address shown in the audit log: the first and last four characters only. */
const maskAddress = (address: string): string => (address.length > 8 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address ? '••••' : '');

/**
 * Where buyers send their money (2026-11-26). Bank and USDT are the OWNER's settings in the database; until the OWNER
 * saves them once, the `PAY_*` env values stay in force, so a deploy changes nothing by itself. The exchange method
 * still comes from env. Only fully filled, enabled methods are offered: a half instruction (a USDT address without its
 * network) is worse than none.
 */
@Injectable()
export class PaymentSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private env(key: keyof Env): string {
    return ((this.config.get(key, { infer: true }) as string | undefined) ?? '').trim();
  }

  private row(): Promise<PaymentSettings | null> {
    return this.prisma.paymentSettings.findUnique({ where: { id: ID } });
  }

  async instructions(): Promise<PaymentInstructions> {
    const row = await this.row();
    const env = (...keys: (keyof Env)[]) => keys.every((key) => this.env(key) !== '');
    const exchange = env('PAY_EXCHANGE_NAME', 'PAY_EXCHANGE_CONTACT', 'PAY_EXCHANGE_INSTRUCTIONS')
      ? { name: this.env('PAY_EXCHANGE_NAME'), contact: this.env('PAY_EXCHANGE_CONTACT'), instructions: this.env('PAY_EXCHANGE_INSTRUCTIONS') }
      : null;
    const envMock = this.env('PAY_MOCK').toLowerCase() === 'true';

    if (!row) {
      return {
        bank: env('PAY_BANK_NAME', 'PAY_BANK_ACCOUNT_NUMBER', 'PAY_BANK_ACCOUNT_HOLDER')
          ? { name: this.env('PAY_BANK_NAME'), accountNumber: this.env('PAY_BANK_ACCOUNT_NUMBER'), accountHolder: this.env('PAY_BANK_ACCOUNT_HOLDER') }
          : null,
        usdt: env('PAY_USDT_NETWORK', 'PAY_USDT_ADDRESS') ? { network: this.env('PAY_USDT_NETWORK'), address: this.env('PAY_USDT_ADDRESS') } : null,
        exchange,
        mock: envMock,
      };
    }

    return {
      bank:
        row.bankEnabled && row.bankName && row.bankAccountNumber && row.bankAccountHolder
          ? { name: row.bankName, accountNumber: row.bankAccountNumber, accountHolder: row.bankAccountHolder }
          : null,
      usdt: row.usdtEnabled && row.usdtAddress ? { network: row.usdtNetwork, address: row.usdtAddress } : null,
      exchange,
      // The exchange details are still env values, so env's flag still speaks for them while they are offered.
      mock: row.showTestWarning || (exchange !== null && envMock),
    };
  }

  /**
   * What a payment of this method is being sent to right now, as a line for the payment row; or a 400 when the method
   * is not offered at the moment (switched off, or not configured) — a buyer cannot pay into a closed account.
   */
  async destinationFor(method: PaymentMethod): Promise<string | null> {
    const now = await this.instructions();
    if (method === 'BANK_IDR' && now.bank) return `${now.bank.name} ${now.bank.accountNumber} a.n. ${now.bank.accountHolder}`;
    if (method === 'USDT' && now.usdt) return `USDT ${now.usdt.network} ${now.usdt.address}`;
    if (method === 'EXCHANGE' && now.exchange) return null; // the exchange pays BaliTrade's bank itself
    throw new BadRequestException('This payment method is not offered at the moment');
  }

  /** FINANCE reads this to match statements; only the OWNER saves it. Before the first save it shows the env values. */
  async adminView(): Promise<AdminPaymentSettingsView> {
    const row = await this.row();
    const exchangeIsPlaceholder =
      this.env('PAY_MOCK').toLowerCase() === 'true' &&
      ['PAY_EXCHANGE_NAME', 'PAY_EXCHANGE_CONTACT', 'PAY_EXCHANGE_INSTRUCTIONS'].every((key) => this.env(key as keyof Env) !== '');
    if (!row) {
      const network = this.env('PAY_USDT_NETWORK') as UsdtNetwork;
      return {
        saved: false,
        bankEnabled: this.env('PAY_BANK_ACCOUNT_NUMBER') !== '',
        bankName: this.env('PAY_BANK_NAME'),
        bankAccountNumber: this.env('PAY_BANK_ACCOUNT_NUMBER'),
        bankAccountHolder: this.env('PAY_BANK_ACCOUNT_HOLDER'),
        usdtEnabled: this.env('PAY_USDT_ADDRESS') !== '',
        usdtNetwork: (USDT_NETWORKS as readonly string[]).includes(network) ? network : 'TRC20',
        usdtAddress: this.env('PAY_USDT_ADDRESS'),
        showTestWarning: this.env('PAY_MOCK').toLowerCase() === 'true',
        exchangeIsPlaceholder,
        updatedBy: null,
        updatedAt: null,
      };
    }
    const by = row.updatedById ? await this.prisma.user.findUnique({ where: { id: row.updatedById }, select: { id: true, name: true } }) : null;
    return {
      saved: true,
      bankEnabled: row.bankEnabled,
      bankName: row.bankName,
      bankAccountNumber: row.bankAccountNumber,
      bankAccountHolder: row.bankAccountHolder,
      usdtEnabled: row.usdtEnabled,
      usdtNetwork: row.usdtNetwork as UsdtNetwork,
      usdtAddress: row.usdtAddress,
      showTestWarning: row.showTestWarning,
      exchangeIsPlaceholder,
      updatedBy: by,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** The OWNER's save, with an audit row in the same transaction. The DTO has already checked shapes and confirmations. */
  async save(dto: PaymentSettingsDto, ownerId: string): Promise<AdminPaymentSettingsView> {
    const data = {
      bankEnabled: dto.bankEnabled,
      bankName: dto.bankName,
      bankAccountNumber: dto.bankAccountNumber,
      bankAccountHolder: dto.bankAccountHolder,
      usdtEnabled: dto.usdtEnabled,
      usdtNetwork: dto.usdtNetwork,
      usdtAddress: dto.usdtAddress,
      showTestWarning: dto.showTestWarning,
      updatedById: ownerId,
    };
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.paymentSettings.findUnique({ where: { id: ID } });
      await tx.paymentSettings.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
      const masked = (row: Pick<PaymentSettings, 'bankEnabled' | 'bankName' | 'bankAccountNumber' | 'usdtEnabled' | 'usdtNetwork' | 'usdtAddress' | 'showTestWarning'> | null) =>
        row
          ? {
              bankEnabled: row.bankEnabled,
              bankName: row.bankName,
              bankAccount: row.bankAccountNumber ? maskAccount(row.bankAccountNumber) : '',
              usdtEnabled: row.usdtEnabled,
              usdtNetwork: row.usdtNetwork,
              usdtAddress: maskAddress(row.usdtAddress),
              showTestWarning: row.showTestWarning,
            }
          : null;
      // Never the full account number or address in the log (AuditService's rule): last four digits, first/last four characters.
      await this.audit.record(tx, {
        actorId: ownerId,
        action: 'PAYMENT_SETTINGS_UPDATED',
        entity: 'payment_settings',
        entityId: ID,
        data: { before: masked(before), after: masked({ ...data }) },
      });
    });
    return this.adminView();
  }
}
