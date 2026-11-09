import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { actionActor, isAdmin, nextOrderStatus, orderActionsFor, orderCode } from '@balitrade/shared';
import type { AuthUser, DeliveryAddress, OrderAction, OrderView, OrderViewer } from '@balitrade/shared';
import { ChatService } from '../chat/chat.service.js';
import { MessageRateLimiter } from '../chat/message-rate-limiter.js';
import { idrToUsd } from '../fx/fx-math.js';
import { FxService } from '../fx/fx.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';

const LIST_LIMIT = 100;

const orderInclude = {
  buyer: { select: { id: true, name: true } },
  seller: { select: { id: true, displayName: true, userId: true } },
  items: true,
  conversation: { select: { id: true } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/** Order requests (T15). Money is copied into the order at the moment of the request; nothing is recomputed later. */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
    private readonly chat: ChatService,
    private readonly notifications: NotificationsService,
    private readonly limiter: MessageRateLimiter,
  ) {}

  async create(user: AuthUser, dto: CreateOrderDto): Promise<OrderView> {
    if (!user.roles.includes('BUYER')) {
      throw new ForbiddenException('Only buyers can request an order');
    }
    this.limiter.consume(user.id);

    const rate = await this.fx.latest();
    if (!rate) {
      throw new ConflictException('The exchange rate is not set yet, so orders cannot be priced in USD');
    }
    // Only products buyers can see can be ordered; anything else looks like it does not exist.
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, status: 'APPROVED', seller: { status: 'APPROVED' } },
      include: { translations: true, seller: { include: { qcZone: true, user: { select: { locale: true } } } } },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.seller.userId === user.id) {
      throw new ForbiddenException('You cannot order your own product');
    }
    if (dto.qty < product.moq) {
      throw new BadRequestException(`The minimum order is ${product.moq}`);
    }
    if (product.type === 'READY_STOCK' && product.stockQty !== null && dto.qty > product.stockQty) {
      throw new BadRequestException(`Only ${product.stockQty} in stock`);
    }

    // The unit price is rounded to cents first (it is what the buyer saw), so the total is exactly qty × that price.
    const unitPriceUsd = idrToUsd(product.priceIdr, rate.rate);
    const itemsUsd = new Prisma.Decimal(unitPriceUsd).mul(dto.qty);
    const qcFeeUsd = product.seller.qcZone?.feeUsd ?? new Prisma.Decimal(0);
    const titleIn = (locale: string): string =>
      (product.translations.find((t) => t.locale === locale) ?? product.translations.find((t) => t.locale === product.sourceLocale))?.title ?? '';
    const buyerTitle = titleIn(user.locale);

    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          buyerId: user.id,
          sellerId: product.sellerId,
          deliveryAddress: dto.delivery as unknown as Prisma.InputJsonValue,
          fxRate: rate.rate,
          itemsUsd,
          qcFeeUsd,
          items: {
            create: {
              productId: product.id,
              title: buyerTitle,
              unit: product.unit,
              qty: dto.qty,
              unitPriceIdr: product.priceIdr,
              unitPriceUsd,
              note: dto.note ? dto.note : null,
            },
          },
        },
        include: orderInclude,
      });
      const conversation = await tx.conversation.create({
        data: { type: 'ORDER', buyerId: user.id, sellerId: product.sellerId, orderId: order.id },
      });
      const code = orderCode(order.number);
      const message = await this.chat.createSystemMessage(
        tx,
        conversation.id,
        `Order ${code} requested: ${dto.qty} × ${buyerTitle} at $${unitPriceUsd} each (subtotal $${itemsUsd.toFixed(2)}). Waiting for the seller to respond.`,
      );
      return { order: { ...order, conversation: { id: conversation.id } }, message };
    });

    // After the commit: live updates and the seller's notification. A failure here must not undo the order.
    try {
      await this.chat.publishSystemMessage(created.message);
      await this.notifications.notifyOrderRequested(product.seller.userId, {
        orderId: created.order.id,
        code: orderCode(created.order.number),
        buyerName: user.name,
        productTitle: titleIn(product.seller.user.locale),
        qty: dto.qty,
      });
    } catch (error) {
      this.logger.error('Could not announce the new order', error);
    }
    return this.toView(created.order, user);
  }

  /** Buyers and sellers see the orders they take part in; every admin role sees all orders. */
  async list(user: AuthUser): Promise<OrderView[]> {
    const where: Prisma.OrderWhereInput = isAdmin(user.roles) ? {} : { OR: [{ buyerId: user.id }, { seller: { userId: user.id } }] };
    const rows = await this.prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, take: LIST_LIMIT });
    return rows.map((row) => this.toView(row, user));
  }

  async get(user: AuthUser, orderId: string): Promise<OrderView> {
    const row = await this.prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
    // For anyone who is not part of the order it "does not exist".
    if (!row || !(isAdmin(user.roles) || row.buyerId === user.id || row.seller.userId === user.id)) {
      throw new NotFoundException('Order not found');
    }
    return this.toView(row, user);
  }

  /**
   * A seller answers a request (accept, decline, propose a lower quantity); the buyer accepts the change or cancels.
   * `nextOrderStatus` decides what is possible; a status that changed in the meantime answers 409. The change, its system
   * message in the order chat and (after the commit) the other side's notification belong together.
   */
  async act(user: AuthUser, orderId: string, action: OrderAction, input: { qty?: number; reason?: string } = {}): Promise<OrderView> {
    const row = await this.prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
    const isBuyer = row?.buyerId === user.id;
    const isSeller = row?.seller.userId === user.id;
    // For anyone outside the order it "does not exist"; admins can read it but do not take these actions.
    if (!row || !(isAdmin(user.roles) || isBuyer || isSeller)) {
      throw new NotFoundException('Order not found');
    }
    // Money and QC steps belong to PaymentsService, which checks the admin role; they never come in through here.
    if (actionActor(action) === 'ADMIN') {
      throw new ForbiddenException('This step is not taken here');
    }
    if ((actionActor(action) === 'SELLER' && !isSeller) || (actionActor(action) === 'BUYER' && !isBuyer)) {
      throw new ForbiddenException('You cannot do this on this order');
    }
    const next = nextOrderStatus(row.status, action);
    if (!next) {
      throw new ConflictException(`This is not possible while the order is ${row.status}`);
    }

    const item = row.items[0]!;
    if (action === 'PROPOSE_CHANGE' && (input.qty === undefined || input.qty >= item.qty)) {
      throw new BadRequestException('A proposed quantity must be lower than the requested one');
    }
    const code = orderCode(row.number);
    const reason = input.reason ? ` Reason: ${input.reason}` : '';
    const money = (value: Prisma.Decimal) => `$${value.toFixed(2)}`;
    const subtotal = (qty: number) => new Prisma.Decimal(item.unitPriceUsd).mul(qty);

    let message: string;
    let itemData: Prisma.OrderItemUpdateInput = {};
    let itemsUsd: Prisma.Decimal | undefined;
    switch (action) {
      case 'ACCEPT':
        message = `Seller accepted order ${code}. Next step: payment. BaliTrade holds the payment until delivery.`;
        itemData = { sellerResponse: 'ACCEPTED' };
        break;
      case 'DECLINE':
        message = `Seller declined order ${code}.${reason}`;
        itemData = { sellerResponse: 'DECLINED', proposedQty: null };
        break;
      case 'PROPOSE_CHANGE':
        message = `Seller proposed a change for order ${code}: ${input.qty} instead of ${item.qty} ${item.unit.toLowerCase()} (subtotal ${money(subtotal(input.qty!))}). The buyer can accept the change or cancel.${reason}`;
        itemData = { sellerResponse: 'CHANGE_PROPOSED', proposedQty: input.qty! };
        break;
      case 'ACCEPT_CHANGE':
        message = `Buyer accepted the change for order ${code}: ${item.proposedQty} × ${item.title} (subtotal ${money(subtotal(item.proposedQty!))}). Next step: payment.`;
        itemData = { qty: item.proposedQty!, proposedQty: null, sellerResponse: 'ACCEPTED' };
        itemsUsd = subtotal(item.proposedQty!);
        break;
      case 'CANCEL':
        message = `Buyer cancelled order ${code}.${reason}`;
        break;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // The status is part of the condition: if someone else changed the order first, nothing is updated and the caller gets 409.
      const updated = await tx.order.updateMany({
        where: { id: row.id, status: row.status },
        data: { status: next, ...(itemsUsd ? { itemsUsd } : {}) },
      });
      if (updated.count === 0) {
        throw new ConflictException('The order was changed in the meantime. Please reload it.');
      }
      if (Object.keys(itemData).length > 0) {
        await tx.orderItem.update({ where: { id: item.id }, data: itemData });
      }
      const chat = row.conversation ? await this.chat.createSystemMessage(tx, row.conversation.id, message) : null;
      return { chat, order: await tx.order.findUniqueOrThrow({ where: { id: row.id }, include: orderInclude }) };
    });

    // After the commit: live updates and the other side's notification. A failure here must not undo the change.
    try {
      if (result.chat) await this.chat.publishSystemMessage(result.chat);
      const recipientId = actionActor(action) === 'SELLER' ? row.buyerId : row.seller.userId;
      await this.notifications.notifyOrderStatus(recipientId, {
        orderId: row.id,
        code,
        status: next,
        productTitle: item.title,
        qty: action === 'PROPOSE_CHANGE' ? input.qty! : action === 'ACCEPT_CHANGE' ? item.proposedQty! : item.qty,
      });
    } catch (error) {
      this.logger.error('Could not announce the order change', error);
    }
    return this.toView(result.order, user);
  }

  private toView(row: OrderRow, user: AuthUser): OrderView {
    const viewer: OrderViewer = isAdmin(user.roles) ? 'ADMIN' : row.buyerId === user.id ? 'BUYER' : 'SELLER';
    const item = row.items[0]!;
    return {
      id: row.id,
      code: orderCode(row.number),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      viewer,
      actions: orderActionsFor(viewer, row.status),
      proposal:
        row.status === 'CHANGE_PROPOSED' && item.proposedQty !== null
          ? {
              qty: item.proposedQty,
              itemsUsd: new Prisma.Decimal(item.unitPriceUsd).mul(item.proposedQty).toFixed(2),
              totalUsd: new Prisma.Decimal(item.unitPriceUsd).mul(item.proposedQty).add(row.qcFeeUsd).toFixed(2),
            }
          : null,
      buyer: row.buyer,
      seller: { id: row.seller.id, displayName: row.seller.displayName },
      item: {
        productId: item.productId,
        title: item.title,
        unit: item.unit,
        qty: item.qty,
        unitPriceIdr: item.unitPriceIdr,
        unitPriceUsd: item.unitPriceUsd.toFixed(2),
        note: item.note,
        sellerResponse: item.sellerResponse,
        proposedQty: item.proposedQty,
      },
      totals: {
        itemsUsd: row.itemsUsd.toFixed(2),
        qcFeeUsd: row.qcFeeUsd.toFixed(2),
        totalUsd: row.itemsUsd.add(row.qcFeeUsd).toFixed(2),
      },
      fxRate: row.fxRate.toFixed(4),
      // The seller hands the goods to BaliTrade, so the buyer's address stays private.
      delivery: viewer === 'SELLER' ? null : (row.deliveryAddress as unknown as DeliveryAddress),
      conversationId: row.conversation?.id ?? null,
    };
  }
}
