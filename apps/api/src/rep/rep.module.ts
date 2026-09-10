import { Module } from '@nestjs/common';
import { RepController } from './rep.controller';
import { RepService } from './rep.service';
import { UsageService } from '../billing/usage.service';
import { NetworkModule } from '../config/network.module';

@Module({
  // NetworkConfig was a local provider here. BuilderPay reads the same chain
  // settings now, so it comes from NetworkModule — one instance, one answer to
  // "which network are we on".
  imports: [NetworkModule],
  controllers: [RepController],
  providers: [RepService, UsageService],
  exports: [RepService, UsageService],
})
export class RepModule {}
