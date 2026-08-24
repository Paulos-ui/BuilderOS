import { Module } from '@nestjs/common';
import { RepController } from './rep.controller';
import { RepService } from './rep.service';
import { UsageService } from '../billing/usage.service';
import { NetworkConfig } from '../config/network.config';

@Module({
  controllers: [RepController],
  providers: [RepService, UsageService, NetworkConfig],
  exports: [RepService, UsageService],
})
export class RepModule {}
