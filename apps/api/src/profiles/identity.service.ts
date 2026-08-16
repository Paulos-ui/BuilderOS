import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

export interface IdentitySummary {
  email: string | null;
  walletAddress: string | null;
  authProvider: string;
  /** True when both sign-in methods are attached to this account. */
  fullyLinked: boolean;
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async summary(builderProfileId: string): Promise<IdentitySummary> {
    const profile = await this.prisma.builderProfile.findUnique({
      where: { id: builderProfileId },
      select: {
        user: {
          select: { email: true, walletAddress: true, authProvider: true },
        },
      },
    });
    if (!profile?.user) throw new NotFoundException('Profile not found');

    const { email, walletAddress, authProvider } = profile.user;
    return {
      email,
      walletAddress,
      authProvider,
      fullyLinked: Boolean(email && walletAddress),
    };
  }

  /**
   * Attaches a wallet to the signed-in account.
   *
   * The signature is verified through the same SIWE path as sign-in, so
   * linking proves address control exactly as strongly as authenticating
   * with it does. Anything weaker would let a signed-in user claim an
   * address they don't hold.
   */
  async linkWallet(
    builderProfileId: string,
    message: string,
    signature: string,
  ): Promise<IdentitySummary> {
    const address = await this.authService.verifyWalletSignature(
      message,
      signature,
    );
    const normalized = address.toLowerCase();

    const profile = await this.prisma.builderProfile.findUnique({
      where: { id: builderProfileId },
      select: { userId: true, user: { select: { email: true } } },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    const owner = await this.prisma.user.findUnique({
      where: { walletAddress: normalized },
      select: { id: true },
    });

    if (owner && owner.id !== profile.userId) {
      // Merging two populated accounts is a genuinely destructive operation
      // (which profile's history survives?). Refusing is the safe answer
      // until there is a considered merge flow.
      throw new ConflictException(
        'That wallet is already linked to a different BuilderOS account. Sign in with it directly, or use another address.',
      );
    }

    await this.prisma.user.update({
      where: { id: profile.userId },
      data: {
        walletAddress: normalized,
        authProvider: profile.user?.email ? 'BOTH' : 'WALLET',
      },
    });

    return this.summary(builderProfileId);
  }

  /**
   * Attaches an email to the signed-in account, gated on a verified OTP —
   * the caller must have already proven control of the inbox.
   */
  async linkVerifiedEmail(
    builderProfileId: string,
    email: string,
  ): Promise<IdentitySummary> {
    const normalized = email.trim().toLowerCase();

    const profile = await this.prisma.builderProfile.findUnique({
      where: { id: builderProfileId },
      select: { userId: true, user: { select: { walletAddress: true } } },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    const owner = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true },
    });

    if (owner && owner.id !== profile.userId) {
      throw new ConflictException(
        'That email already belongs to a different BuilderOS account.',
      );
    }

    await this.prisma.user.update({
      where: { id: profile.userId },
      data: {
        email: normalized,
        authProvider: profile.user?.walletAddress ? 'BOTH' : 'EMAIL',
      },
    });

    return this.summary(builderProfileId);
  }
}
