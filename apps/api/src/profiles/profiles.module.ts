import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { IdentityService } from './identity.service';
import { LinkEmailController } from './link-email.controller';
import { OtpService } from '../auth/otp.service';
import { MailerService } from '../common/mailer.service';
import { AuthModule } from '../auth/auth.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  imports: [AuthModule, EmbeddingsModule],
  controllers: [ProfilesController, LinkEmailController],
  providers: [ProfilesService, IdentityService, OtpService, MailerService],
  // MatchModule reuses profileText() and refreshEmbedding() so the vector a
  // match is computed against is built the same way it was stored.
  exports: [ProfilesService],
})
export class ProfilesModule {}
