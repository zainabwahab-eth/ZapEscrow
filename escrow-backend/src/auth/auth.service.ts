import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { SellersService } from '../sellers/sellers.service';
import { EmailService } from '../email/email.service';

const OTP_TTL_SECONDS = 600; // 10 min
const SIGNUP_TOKEN_TTL = '5m';

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

  private generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private issueSessionToken(sellerId: string): string {
    return this.jwtService.sign(
      { sellerId },
      { expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '7d') },
    );
  }

  /** Web signup, step 1 — find-or-create the account and email a one-time code. */
  async initiateSignup(email: string) {
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

    return { token: this.issueSessionToken(updated.id), seller: this.sellersService.toPublic(updated) };
  }

  async login(email: string, password: string) {
    const seller = await this.prisma.seller.findUnique({ where: { email } });
    if (!seller?.passwordHash || !(await bcrypt.compare(password, seller.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return { token: this.issueSessionToken(seller.id), seller: this.sellersService.toPublic(seller) };
  }
}
