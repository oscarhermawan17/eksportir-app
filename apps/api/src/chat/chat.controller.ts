import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser, ChatMessageView, ConversationView } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ChatService } from './chat.service.js';
import { MessagesQueryDto, SendMessageDto, StartInquiryDto } from './dto/chat.dto.js';

/** Any logged-in user; what each person may see is decided in ChatService (buyer, seller, moderating admin). */
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  start(@CurrentUser() user: AuthUser, @Body() dto: StartInquiryDto): Promise<ConversationView> {
    return this.chat.startInquiry(user, dto.productId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ConversationView[]> {
    return this.chat.list(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ConversationView> {
    return this.chat.get(user, id);
  }

  @Get(':id/messages')
  messages(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() query: MessagesQueryDto): Promise<ChatMessageView[]> {
    return this.chat.messages(user, id, query.before);
  }

  @Post(':id/messages')
  send(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SendMessageDto): Promise<ChatMessageView> {
    return this.chat.send(user, id, dto.body);
  }
}
