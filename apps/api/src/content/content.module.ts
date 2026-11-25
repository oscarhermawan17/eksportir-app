import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminContentController, ContentController } from './content.controller.js';
import { ContentService } from './content.service.js';

@Module({
  // AuthModule: the admin controller is behind JwtAuthGuard + RolesGuard.
  imports: [AuthModule],
  controllers: [ContentController, AdminContentController],
  providers: [ContentService],
})
export class ContentModule {}
