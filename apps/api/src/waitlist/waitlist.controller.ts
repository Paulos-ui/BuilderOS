import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';

@Controller('v1/waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  /**
   * Public endpoint, so it gets a tighter throttle than the global default:
   * 5 submissions per minute per IP is far more than a real person needs and
   * far less than a script wants.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  join(@Body() dto: CreateWaitlistDto) {
    return this.waitlistService.join(dto);
  }
}
