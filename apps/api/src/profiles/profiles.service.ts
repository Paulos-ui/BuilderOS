import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(builderProfileId: string) {
    const profile = await this.prisma.builderProfile.findUnique({
      where: { id: builderProfileId },
      include: {
        user: {
          select: { email: true, walletAddress: true, createdAt: true },
        },
      },
    });
    if (!profile) throw new NotFoundException('Builder profile not found');
    return profile;
  }

  update(builderProfileId: string, dto: UpdateProfileDto) {
    return this.prisma.builderProfile.update({
      where: { id: builderProfileId },
      data: {
        ...(dto.githubUsername !== undefined && {
          githubUsername: dto.githubUsername,
        }),
        ...(dto.chains !== undefined && { chains: dto.chains }),
        ...(dto.languages !== undefined && { languages: dto.languages }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
      },
    });
  }

  /**
   * Public-facing view of a profile (for the shareable reputation page,
   * Blueprint Section 9.3) — deliberately excludes email/wallet and any
   * internal fields.
   */
  async findPublicById(builderProfileId: string) {
    const profile = await this.prisma.builderProfile.findUnique({
      where: { id: builderProfileId },
      select: {
        id: true,
        githubUsername: true,
        chains: true,
        languages: true,
        bio: true,
        createdAt: true,
      },
    });
    if (!profile) throw new NotFoundException('Builder profile not found');
    return profile;
  }
}
