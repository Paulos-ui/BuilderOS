import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProfilesModule } from './profiles/profiles.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { AgentsModule } from './agents/agents.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { ProofForgeModule } from './proofforge/proofforge.module';
import { FlowModule } from './flow/flow.module';
import { RepModule } from './rep/rep.module';
import { MatchModule } from './match/match.module';
import { PayModule } from './pay/pay.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        // Blueprint Section 18: rate limiting on all public endpoints.
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    ProfilesModule,
    WaitlistModule,
    AgentsModule,
    OpportunitiesModule,
    ProofForgeModule,
    FlowModule,
    RepModule,
    // AG-04 and AG-06. Both were defined in the agent manifests and neither had
    // an implementation, which is what made the console's "4/6" honest.
    MatchModule,
    PayModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
