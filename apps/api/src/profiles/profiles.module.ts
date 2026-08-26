import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { IdentityService } from './identity.service';
import { LinkEmailController } from './link-email.controller';
import { OtpService } from '../auth/otp.service';
import { MailerService } from '../common/mailer.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProfilesController, LinkEmailController],
  providers: [ProfilesService, IdentityService, OtpService, MailerService],
})
export class ProfilesModule {}
