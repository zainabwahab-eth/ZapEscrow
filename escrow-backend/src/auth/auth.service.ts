import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { SellersService } from '../sellers/sellers.service';
import { EmailService } from '../email/email.service';

const OTP_TTL_SECONDS = 600; // 10 min
const SIGNUP_TOKEN_TTL = '5m';
const PASSWORD_RESET_TTL_SECONDS = 30 * 60; // 30 min
const REMEMBERED_SESSION_TTL = '30d';
const UNREMEMBERED_SESSION_TTL = '1d';

interface SignupVerifiedPayload {
  email: string;
  purpose: 'signup-verified';
}

@Injectable()
export class AuthService {
  private redis: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sellersService: SellersService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
  ) {
    this.redis = new Redis(this.config.get<string>('REDIS_URL', 'redis://localhost:6379'));
  }

  private otpKey(email: string) {
    return `web-otp:${email}`;
  }

  private resetTokenKey(token: string) {
    return `password-reset:${token}`;
  }

  private generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private generateResetToken(): string {
    return randomBytes(32).toString('hex');
  }

  private issueSessionToken(sellerId: string, rememberMe: boolean): string {
    return this.jwtService.sign(
      { sellerId },
      { expiresIn: rememberMe ? REMEMBERED_SESSION_TTL : UNREMEMBERED_SESSION_TTL },
    );
  }

  /** Web signup, step 1 — find-or-create the account and email a one-time code. */
  async initiateSignup(email: string) {
    const existing = await this.prisma.seller.findUnique({ where: { email } });
    if (existing?.passwordHash) {
      throw new ConflictException('An account with this email already exists. Please log in instead.');
    }

    // No existing seller, or one created via Telegram that hasn't set a
    // dashboard password yet — both cases proceed as before.
    await this.sellersService.findOrCreateByEmail(email);

    const code = this.generateOtp();
    await this.redis.set(this.otpKey(email), code, 'EX', OTP_TTL_SECONDS);
    await this.emailService.sendOtp(email, code);

    return { message: 'Verification code sent to your email' };
  }

  /** Web signup, step 2 — matches the code and hands back a short-lived token authorizing step 3. */
  async verifyOtp(email: string, code: string) {
    const stored = await this.redis.get(this.otpKey(email));
    if (!stored || stored !== code) {
      throw new BadRequestException("That code doesn't match — check your email and try again.");
    }

    await this.redis.del(this.otpKey(email));

    const verifiedToken = this.jwtService.sign(
      { email, purpose: 'signup-verified' } satisfies SignupVerifiedPayload,
      { expiresIn: SIGNUP_TOKEN_TTL },
    );
    return { verifiedToken };
  }

  /** Web signup, step 3 — sets the password now that the email is verified, and starts a session. */
  async completeSignup(email: string, password: string, verifiedToken: string) {
    let payload: SignupVerifiedPayload;
    try {
      payload = this.jwtService.verify<SignupVerifiedPayload>(verifiedToken);
    } catch {
      throw new BadRequestException('Verification expired or invalid — please verify your email again.');
    }
    if (payload.purpose !== 'signup-verified' || payload.email !== email) {
      throw new BadRequestException('Verification expired or invalid — please verify your email again.');
    }

    const seller = await this.prisma.seller.findUnique({ where: { email } });
    if (!seller) throw new BadRequestException('No signup in progress for this email');

    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await this.prisma.seller.update({
      where: { id: seller.id },
      data: { passwordHash, emailVerifiedAt: new Date() },
    });

    return { token: this.issueSessionToken(updated.id, true), seller: this.sellersService.toPublic(updated) };
  }

  async login(email: string, password: string, rememberMe: boolean) {
    const seller = await this.prisma.seller.findUnique({ where: { email } });
    if (!seller?.passwordHash || !(await bcrypt.compare(password, seller.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return { token: this.issueSessionToken(seller.id, rememberMe), seller: this.sellersService.toPublic(seller) };
  }

  /** Forgot password, step 1 — always returns the same generic message so the response can't be used to check which emails have accounts. */
  async initiateForgotPassword(email: string) {
    const seller = await this.prisma.seller.findUnique({ where: { email } });
    if (seller) {
      const token = this.generateResetToken();
      await this.redis.set(this.resetTokenKey(token), seller.id, 'EX', PASSWORD_RESET_TTL_SECONDS);
      const resetUrl = `${this.config.get<string>('PUBLIC_FRONTEND_URL', '')}/reset-password?token=${token}`;
      await this.emailService.sendPasswordReset(email, resetUrl);
    }

    return { message: "If an account exists for that email, we've sent a reset link." };
  }

  /** Forgot password, step 2 — the token is single-use and deleted immediately on success. */
  async resetPassword(token: string, password: string) {
    const sellerId = await this.redis.get(this.resetTokenKey(token));
    if (!sellerId) {
      throw new BadRequestException('This reset link has expired or is invalid — please request a new one.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.seller.update({ where: { id: sellerId }, data: { passwordHash } });
    await this.redis.del(this.resetTokenKey(token));

    return { message: 'Password updated — you can now log in.' };
  }
}
