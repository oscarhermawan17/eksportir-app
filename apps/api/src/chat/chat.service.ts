import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CHAT_LIMITS, ConversationType } from '@balitrade/shared';
import type { AuthUser, ChatMessageView, ChatRole, ConversationView } from '@balitrade/shared';
import { Prisma } from '../generated/prisma/client.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const LIST_LIMIT = 100;

const conversationInclude = {
  product: {
    include: {
      translations: true,
      media: { where: { type: 'IMAGE' }, orderBy: { sort: 'asc' }, take: 1 },
    },
  },
  buyer: { select: { id: true, name: true } },
  seller: { select: { id: true, displayName: true, userId: true } },
  messages: { orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;
type MessageRow = Prisma.MessageGetPayload<{ include: { sender: { select: { id: true; name: true } } } }>;

/** ADMIN_OPS and ADMIN_OWNER take part in every conversation (ARCHITECTURE §7); finance and other roles do not. */
const isModerator = (user: AuthUser): boolean => user.roles.includes('ADMIN_OPS') || user.roles.includes('ADMIN_OWNER');

/** Conversations between buyers and sellers, with the BaliTrade admin always able to read and write. */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  /** Starts the buyer's conversation about a product, or returns the one that already exists. */
  async startInquiry(user: AuthUser, productId: string): Promise<ConversationView> {
    if (!user.roles.includes('BUYER')) {
      throw new ForbiddenException('Only buyers can ask about a product');
    }
    // Only products buyers can see are open for questions; anything else looks like it does not exist.
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: 'APPROVED', seller: { status: 'APPROVED' } },
      select: { id: true, sellerId: true, seller: { select: { userId: true } } },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.seller.userId === user.id) {
      throw new ForbiddenException('You cannot ask about your own product');
    }

    const where = { buyerId_productId: { buyerId: user.id, productId: product.id } };
    let conversation = await this.prisma.conversation.findUnique({ where, include: conversationInclude });
    if (!conversation) {
      try {
        conversation = await this.prisma.conversation.create({
          data: { type: ConversationType.PRODUCT_INQUIRY, buyerId: user.id, sellerId: product.sellerId, productId: product.id },
          include: conversationInclude,
        });
      } catch (error) {
        // Two requests at once: the other one created it first.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          conversation = await this.prisma.conversation.findUniqueOrThrow({ where, include: conversationInclude });
        } else {
          throw error;
        }
      }
    }
    return this.toConversationView(conversation, user);
  }

  async list(user: AuthUser): Promise<ConversationView[]> {
    const where: Prisma.ConversationWhereInput = isModerator(user)
      ? {}
      : { OR: [{ buyerId: user.id }, { seller: { userId: user.id } }] };
    const rows = await this.prisma.conversation.findMany({
      where,
      include: conversationInclude,
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: LIST_LIMIT,
    });
    return rows.map((row) => this.toConversationView(row, user));
  }

  async get(user: AuthUser, conversationId: string): Promise<ConversationView> {
    return this.toConversationView(await this.findAccessible(user, conversationId), user);
  }

  /** The newest page of messages (oldest first), or the page before `before`. */
  async messages(user: AuthUser, conversationId: string, before?: string): Promise<ChatMessageView[]> {
    const conversation = await this.findAccessible(user, conversationId);
    const rows = await this.prisma.message.findMany({
      where: { conversationId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      include: { sender: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: CHAT_LIMITS.pageSize,
    });
    return rows.reverse().map((row) => this.toMessageView(row, conversation));
  }

  async send(user: AuthUser, conversationId: string, body: string): Promise<ChatMessageView> {
    const conversation = await this.findAccessible(user, conversationId);
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { conversationId, senderId: user.id, body },
        include: { sender: { select: { id: true, name: true } } },
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: created.createdAt } });
      return created;
    });
    return this.toMessageView(message, conversation);
  }

  /** Participants are the buyer, the seller and the moderating admins; for anyone else the conversation "does not exist". */
  private async findAccessible(user: AuthUser, conversationId: string): Promise<ConversationRow> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: conversationInclude,
    });
    const allowed =
      conversation !== null &&
      (conversation.buyerId === user.id || conversation.seller.userId === user.id || isModerator(user));
    if (!conversation || !allowed) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  private roleOf(senderId: string, conversation: ConversationRow): ChatRole {
    if (senderId === conversation.buyerId) return 'BUYER';
    if (senderId === conversation.seller.userId) return 'SELLER';
    return 'ADMIN';
  }

  private toMessageView(message: MessageRow, conversation: ConversationRow): ChatMessageView {
    const role = this.roleOf(message.senderId, conversation);
    return {
      id: message.id,
      conversationId: message.conversationId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      sender: { id: message.senderId, name: role === 'SELLER' ? conversation.seller.displayName : message.sender.name, role },
    };
  }

  private toConversationView(row: ConversationRow, user: AuthUser): ConversationView {
    const { product } = row;
    // The product title in the viewer's language, else the seller's own language.
    const text = product
      ? (product.translations.find((t) => t.locale === user.locale) ??
        product.translations.find((t) => t.locale === product.sourceLocale))
      : undefined;
    const last = row.messages[0];
    const cover = product?.media[0];
    return {
      id: row.id,
      type: row.type,
      product: product ? { id: product.id, title: text?.title ?? '', coverUrl: cover ? this.media.publicUrlFor(cover.r2Key) : null } : null,
      buyer: row.buyer,
      seller: { id: row.seller.id, displayName: row.seller.displayName },
      lastMessage: last ? { body: last.body, senderRole: this.roleOf(last.senderId, row), createdAt: last.createdAt.toISOString() } : null,
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
