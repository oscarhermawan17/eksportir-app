import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.js';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { FxModule } from './fx/fx.module.js';
import { MediaModule } from './media/media.module.js';
import { ProductsModule } from './products/products.module.js';
import { SellersModule } from './sellers/sellers.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
    AdminModule,
    SellersModule,
    MediaModule,
    FxModule,
    ProductsModule,
    HealthModule,
  ],
})
export class AppModule {}
