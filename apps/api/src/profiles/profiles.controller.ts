import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { ProfilesService } from './profiles.service';
import { IdentityService } from './identity.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('v1/profiles')
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly identityService: IdentityService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.profilesService.findById(user.builderProfileId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.profilesService.update(user.builderProfileId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/identity')
  getIdentity(@CurrentUser() user: JwtPayload) {
    return this.identityService.summary(user.builderProfileId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/link-wallet')
  linkWallet(
    @CurrentUser() user: JwtPayload,
    @Body() body: { message: string; signature: string },
  ) {
    return this.identityService.linkWallet(
      user.builderProfileId,
      body.message,
      body.signature,
    );
  }

  // Public — powers the shareable reputation profile (no auth guard).
  @Get(':id')
  getPublic(@Param('id') id: string) {
    return this.profilesService.findPublicById(id);
  }
}
