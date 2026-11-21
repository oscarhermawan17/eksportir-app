import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

/** What an audit row can say. Add a name here rather than passing free text, so the log stays searchable. */
export type AuditAction = 'ORDER_COMPLETED_BY_ADMIN' | 'PAYOUT_RECORDED' | 'SELLER_BANK_UPDATED';

/**
 * The one way to write the audit log (T20). It takes the caller's transaction client on purpose: the row is written in
 * the same transaction as the action it describes, so there is never an action without its record, or a record of an
 * action that was rolled back. There is deliberately no method to read, change or delete rows — the log is append-only,
 * and nothing in the API exposes it. Callers must never put a full bank account number in `data`.
 */
@Injectable()
export class AuditService {
  async record(
    tx: Prisma.TransactionClient,
    entry: { actorId: string | null; action: AuditAction; entity: 'order' | 'seller'; entityId: string; data: Record<string, unknown> },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        data: entry.data as Prisma.InputJsonValue,
      },
    });
  }
}
