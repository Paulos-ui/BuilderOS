import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';

export interface WaitlistResult {
  status: 'joined' | 'already_joined';
  position?: number;
}

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a beta signup.
   *
   * Re-submitting the same address is treated as success rather than an
   * error: the person's intent ("put me on the list") is already satisfied,
   * and surfacing a hard failure would just make them think it didn't work.
   * We update the optional fields in case they filled in more the second
   * time round.
   */
  async join(dto: CreateWaitlistDto): Promise<WaitlistResult> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.waitlistSignup.findUnique({
      where: { email },
    });

    if (existing) {
      await this.prisma.waitlistSignup.update({
        where: { email },
        data: {
          name: dto.name ?? existing.name,
          role: dto.role ?? existing.role,
          ecosystem: dto.ecosystem ?? existing.ecosystem,
          goal: dto.goal ?? existing.goal,
        },
      });
      return { status: 'already_joined' };
    }

    await this.prisma.waitlistSignup.create({
      data: {
        email,
        name: dto.name,
        role: dto.role,
        ecosystem: dto.ecosystem,
        goal: dto.goal,
      },
    });

    const position = await this.prisma.waitlistSignup.count();
    this.logger.log(`Waitlist signup #${position}`);

    return { status: 'joined', position };
  }
}
