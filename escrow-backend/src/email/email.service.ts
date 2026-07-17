import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY', '');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromEmail = this.config.get<string>('RESEND_FROM_EMAIL', 'escrow@yourdomain.com');

    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not set — email sending is disabled');
    }
  }

  async sendOtp(to: string, code: string) {
    if (!this.resend) {
      throw new Error('Email sending is not configured (RESEND_API_KEY missing)');
    }

    const { error } = await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject: 'Verify your email',
      html: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
    });
    if (error) {
      this.logger.error(`Failed to send OTP email to ${to}: ${error.message}`);
      throw new Error(error.message);
    }
  }
}
