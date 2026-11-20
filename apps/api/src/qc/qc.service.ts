import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { QC_CHECKLIST, QC_LIMITS, isAdmin, nextOrderStatus, orderCode, qcAutoApproveAt, qcChecklistProblem } from '@balitrade/shared';
import type { AuthUser, OrderAction, OrderStatus, QcChecklistEntry, QcReportView, QcReportsResponse } from '@balitrade/shared';
import { ChatService } from '../chat/chat.service.js';
import { MessageRateLimiter } from '../chat/message-rate-limiter.js';
import { Prisma } from '../generated/prisma/client.js';
import { MediaService, parsePrivateKey } from '../media/media.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SubmitQcReportDto } from './dto/qc.dto.js';

const orderSelect = {
  id: true,
  number: true,
  status: true,
  buyerId: true,
  seller: { select: { userId: true } },
  conversation: { select: { id: true } },
  items: { select: { title: true, qty: true } },
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

const reportInclude = {
  createdBy: { select: { id: true, name: true } },
  media: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.QcReportInclude;

type ReportRow = Prisma.QcReportGetPayload<{ include: typeof reportInclude }>;

/** Who hears about a step besides the order chat (which everyone in the order reads). */
type Audience = 'BUYER' | 'SELLER' | 'BOTH';

/**
 * Quality control of an order (T18). OPS checks the goods and writes a report; the buyer approves it or reports a
 * problem; a problem is talked through in the order chat — B2B goods are not cancelled at the first snag — and OPS
 * then checks again, which is a new round. A report nobody answers is approved after QC_LIMITS.autoApproveHours.
 *
 * Every step follows the pattern of PaymentsService: `nextOrderStatus` decides what is possible, the order is
 * updated on the condition that its status did not change meanwhile (409 otherwise), and the change, the report row
 * and the system message in the order chat are one transaction. Notifications go out after the commit and can never
 * undo it.
 */
@Injectable()
export class QcService {
  private readonly logger = new Logger(QcService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
    private readonly limiter: MessageRateLimiter,
  ) {}

  /** Every round of an order, newest first. The buyer, the seller (transparency) and admins; anyone else gets 404. */
  async list(user: AuthUser, orderId: string): Promise<QcReportsResponse> {
    await this.findForParty(user, orderId);
    return this.reportsOf(orderId);
  }

  /** OPS sends the report of the goods it checked: IN_QC → QC_READY. */
  async submit(admin: AuthUser, orderId: string, dto: SubmitQcReportDto): Promise<QcReportsResponse> {
    const order = await this.findOrder(orderId);
    const next = this.nextOrConflict(order, 'SUBMIT_QC');

    const checklist: QcChecklistEntry[] = dto.checklist.map((entry) => ({
      key: entry.key,
      result: entry.result,
      ...(entry.note ? { note: entry.note } : {}),
    }));
    const problem = qcChecklistProblem(checklist);
    if (problem === 'MISSING_OR_DUPLICATE') {
      throw new BadRequestException(`The checklist must contain each of ${QC_CHECKLIST.join(', ')} exactly once`);
    }
    if (problem === 'FAIL_NEEDS_NOTE') {
      throw new BadRequestException('Explain every failed check in its note');
    }
    // Stored in the fixed checklist order, whatever order the form sent.
    checklist.sort((a, b) => QC_CHECKLIST.indexOf(a.key) - QC_CHECKLIST.indexOf(b.key));

    const media = this.assertOwnMedia(admin, dto.media.map((item) => item.key));
    const alreadyUsed = await this.prisma.qcMedia.count({ where: { r2Key: { in: media.map((item) => item.key) } } });
    if (alreadyUsed > 0) {
      throw new BadRequestException('A file is already part of another QC report');
    }

    const code = orderCode(order.number);
    const passed = checklist.filter((entry) => entry.result === 'PASS').length;

    const result = await this.prisma.$transaction(async (tx) => {
      await this.moveOrder(tx, order, next);
      const last = await tx.qcReport.aggregate({ where: { orderId: order.id }, _max: { round: true } });
      const round = (last._max.round ?? 0) + 1;
      await tx.qcReport.create({
        data: {
          orderId: order.id,
          round,
          checklist: checklist as unknown as Prisma.InputJsonValue,
          comment: dto.comment,
          createdById: admin.id,
          media: { create: media.map((item, index) => ({ r2Key: item.key, type: item.kind, sortOrder: index })) },
        },
      });
      const message =
        `BaliTrade finished quality control for order ${code}${round > 1 ? ` (check ${round})` : ''}: ` +
        `${passed} of ${checklist.length} checks passed. The buyer can approve the report or report a problem; ` +
        `without an answer it is approved automatically after ${QC_LIMITS.autoApproveHours} hours.`;
      return this.systemMessage(tx, order, message);
    });

    await this.announce(result, order, next, 'BOTH');
    return this.reportsOf(order.id);
  }

  /** The buyer accepts the report: QC_READY → QC_APPROVED. */
  async approve(user: AuthUser, orderId: string): Promise<QcReportsResponse> {
    const order = await this.findForBuyer(user, orderId);
    await this.decide(order, { decidedById: user.id, auto: false });
    return this.reportsOf(order.id);
  }

  /** The buyer reports a problem: QC_READY → ISSUE. It opens a discussion in the order chat, not a cancellation. */
  async reportIssue(user: AuthUser, orderId: string, reason: string): Promise<QcReportsResponse> {
    const order = await this.findForBuyer(user, orderId);
    const next = this.nextOrConflict(order, 'REPORT_ISSUE');
    this.limiter.consume(user.id);

    const code = orderCode(order.number);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.moveOrder(tx, order, next);
      await this.closeOpenReport(tx, order.id, { status: 'ISSUE', decidedById: user.id, issueReason: reason });
      return this.systemMessage(
        tx,
        order,
        `Buyer reported a problem with the quality control of order ${code}: ${reason}\n` +
          'BaliTrade will talk it through here with the buyer and the seller (replacement, missing quantity, …) and then check the goods again.',
      );
    });

    await this.announce(result, order, next, 'SELLER');
    return this.reportsOf(order.id);
  }

  /** After the problem was talked through, OPS checks the goods again: ISSUE → IN_QC (the next report is a new round). */
  async redo(orderId: string, note?: string): Promise<QcReportsResponse> {
    const order = await this.findOrder(orderId);
    const next = this.nextOrConflict(order, 'REDO_QC');
    const code = orderCode(order.number);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.moveOrder(tx, order, next);
      return this.systemMessage(tx, order, `BaliTrade will check order ${code} again.${note ? ` Note: ${note}` : ''}`);
    });

    await this.announce(result, order, next, 'BOTH');
    return this.reportsOf(order.id);
  }

  /**
   * Approves every report the buyer left unanswered for QC_LIMITS.autoApproveHours, as a buyer would. Called by
   * QcAutoApproveService; `now` is a parameter so tests can run it without waiting two days. Returns how many it approved.
   */
  async approveOverdue(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - QC_LIMITS.autoApproveHours * 60 * 60 * 1000);
    const overdue = await this.prisma.qcReport.findMany({
      where: { status: 'READY', createdAt: { lte: cutoff }, order: { status: 'QC_READY' } },
      select: { orderId: true },
      take: 100,
    });
    let approved = 0;
    for (const { orderId } of overdue) {
      try {
        await this.decide(await this.findOrder(orderId), { decidedById: null, auto: true });
        approved++;
      } catch (error) {
        // The buyer answered in the meantime (409), which is fine; anything else is logged and retried next round.
        if (!(error instanceof ConflictException)) this.logger.error(`Could not approve the QC report of order ${orderId}`, error);
      }
    }
    return approved;
  }

  /** Approval by the buyer or, after the deadline, by the system. */
  private async decide(order: OrderRow, by: { decidedById: string | null; auto: boolean }): Promise<void> {
    const next = this.nextOrConflict(order, 'APPROVE_QC');
    const code = orderCode(order.number);
    const message = by.auto
      ? `The buyer did not answer the quality control report of order ${code} within ${QC_LIMITS.autoApproveHours} hours, so it was approved automatically. Next step: shipping.`
      : `Buyer approved the quality control report of order ${code}. Next step: shipping.`;

    const result = await this.prisma.$transaction(async (tx) => {
      await this.moveOrder(tx, order, next);
      await this.closeOpenReport(tx, order.id, { status: 'APPROVED', decidedById: by.decidedById, autoApproved: by.auto });
      return this.systemMessage(tx, order, message);
    });

    // The seller always hears about it; the buyer only when it happened without them.
    await this.announce(result, order, next, by.auto ? 'BOTH' : 'SELLER');
  }

  /** Assumes the order is QC_READY, so exactly one READY report exists; the condition makes a double decision a 409. */
  private async closeOpenReport(
    tx: Prisma.TransactionClient,
    orderId: string,
    data: { status: 'APPROVED' | 'ISSUE'; decidedById: string | null; autoApproved?: boolean; issueReason?: string },
  ): Promise<void> {
    const updated = await tx.qcReport.updateMany({
      where: { orderId, status: 'READY' },
      data: { ...data, decidedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new ConflictException('The report was decided in the meantime. Please reload it.');
    }
  }

  /**
   * The media of a report must be files this admin uploaded to the private bucket, each once, with at least one photo.
   * Being the uploader is what keeps a buyer's payment proof (or anyone else's file) out of a report everyone in the
   * order can open. The kind comes from the extension the API chose when it signed the upload.
   */
  private assertOwnMedia(admin: AuthUser, keys: string[]): { key: string; kind: 'IMAGE' | 'VIDEO' }[] {
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('The same file is attached twice');
    }
    const media = keys.map((key) => {
      const parsed = parsePrivateKey(key);
      if (!parsed || parsed.uploaderId !== admin.id) {
        throw new BadRequestException('QC photos and videos must be private files you uploaded yourself');
      }
      return { key, kind: parsed.kind };
    });
    if (!media.some((item) => item.kind === 'IMAGE')) {
      throw new BadRequestException('A QC report needs at least one photo');
    }
    return media;
  }

  private async findOrder(orderId: string): Promise<OrderRow> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: orderSelect });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  /** For anyone outside the order it "does not exist". */
  private async findForParty(user: AuthUser, orderId: string): Promise<OrderRow> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: orderSelect });
    if (!order || !(isAdmin(user.roles) || order.buyerId === user.id || order.seller.userId === user.id)) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  /** The decision is the buyer's alone: the seller and admins can read the report but not answer it for them. */
  private async findForBuyer(user: AuthUser, orderId: string): Promise<OrderRow> {
    const order = await this.findForParty(user, orderId);
    if (order.buyerId !== user.id) {
      throw new ForbiddenException('Only the buyer of this order can do this');
    }
    return order;
  }

  private nextOrConflict(order: OrderRow, action: OrderAction): OrderStatus {
    const next = nextOrderStatus(order.status, action);
    if (!next) {
      throw new ConflictException(`This is not possible while the order is ${order.status}`);
    }
    return next;
  }

  private async moveOrder(tx: Prisma.TransactionClient, order: OrderRow, next: OrderStatus): Promise<void> {
    const updated = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: next } });
    if (updated.count === 0) {
      throw new ConflictException('The order was changed in the meantime. Please reload it.');
    }
  }

  private systemMessage(tx: Prisma.TransactionClient, order: OrderRow, body: string) {
    return order.conversation ? this.chat.createSystemMessage(tx, order.conversation.id, body) : Promise.resolve(null);
  }

  /** Live chat update and notifications, after the commit. A failure here must never undo the step. */
  private async announce(
    chat: Awaited<ReturnType<ChatService['createSystemMessage']>> | null,
    order: OrderRow,
    status: OrderStatus,
    audience: Audience,
  ): Promise<void> {
    try {
      if (chat) await this.chat.publishSystemMessage(chat);
      const item = order.items[0];
      if (!item) return;
      const recipients = [
        ...(audience !== 'SELLER' ? [order.buyerId] : []),
        ...(audience !== 'BUYER' ? [order.seller.userId] : []),
      ];
      for (const userId of recipients) {
        await this.notifications.notifyOrderStatus(userId, {
          orderId: order.id,
          code: orderCode(order.number),
          status,
          productTitle: item.title,
          qty: item.qty,
        });
      }
    } catch (error) {
      this.logger.error('Could not announce the QC change', error);
    }
  }

  private async reportsOf(orderId: string): Promise<QcReportsResponse> {
    const rows = await this.prisma.qcReport.findMany({ where: { orderId }, include: reportInclude, orderBy: { round: 'desc' } });
    return { reports: await Promise.all(rows.map((row) => this.toView(row))) };
  }

  private async toView(row: ReportRow): Promise<QcReportView> {
    return {
      id: row.id,
      round: row.round,
      status: row.status,
      checklist: row.checklist as unknown as QcChecklistEntry[],
      comment: row.comment,
      media: await Promise.all(row.media.map(async (item) => ({ kind: item.type, url: await this.media.signPrivateRead(item.r2Key) }))),
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
      autoApproveAt: row.status === 'READY' ? qcAutoApproveAt(row.createdAt).toISOString() : null,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      autoApproved: row.autoApproved,
      issueReason: row.issueReason,
    };
  }
}
