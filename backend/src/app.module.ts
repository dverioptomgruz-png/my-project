import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { AvitoModule } from './modules/avito/avito.module';
import { BidderModule } from './modules/bidder/bidder.module';
import { AutoloadModule } from './modules/autoload/autoload.module';
import { ChatModule } from './modules/chat/chat.module';
import { CompetitorsModule } from './modules/competitors/competitors.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ABTesterModule } from './modules/ab-tester/ab-tester.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { FunnelModule } from './modules/funnel/funnel.module';
import { N8nModule } from './modules/n8n/n8n.module';
import { SystemModule } from './modules/system/system.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60') * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT || '30'),
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    AvitoModule,
    ABTesterModule,
    BidderModule,
    AutoloadModule,
    ChatModule,
    CompetitorsModule,
    AnalyticsModule,
    ReviewsModule,
    FunnelModule,
    N8nModule,
    SystemModule,
  ],
})
export class AppModule {}
