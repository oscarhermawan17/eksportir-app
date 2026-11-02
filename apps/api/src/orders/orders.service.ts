import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { isAdmin, orderCode } from '@balitrade/shared';
import type { AuthUser, DeliveryAddress, OrderView, OrderViewer } from '@balitrade/shared';
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
