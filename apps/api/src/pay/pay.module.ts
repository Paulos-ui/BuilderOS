import { Module } from '@nestjs/common';
import { PayController, X402Controller } from './pay.controller';
import { X402Service } from './x402.service';
import { X402Interceptor } from './x402.interceptor';
import { NetworkModule } from '../config/network.module';

/**
 * BuilderPay (AG-06).
 *
 * X402Interceptor is exported rather than registered globally. A global
 * interceptor would run on every request in the API to check for metadata that
 * fewer than five routes carry, and — worse — it would put the payment path in
 * the request cycle of the auth and health endpoints. Modules that own a metered
 * route import this and apply it to that route explicitly, so the blast radius
 * of a metering change is the routes that opted in.
 */
@Module({
  imports: [NetworkModule],
  controllers: [PayController, X402Controller],
  providers: [X402Service, X402Interceptor],
  exports: [X402Service, X402Interceptor],
})
export class PayModule {}
