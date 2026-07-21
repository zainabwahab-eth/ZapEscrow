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

  async sendPasswordReset(to: string, resetUrl: string) {
    if (!this.resend) {
      throw new Error('Email sending is not configured (RESEND_API_KEY missing)');
    }

    const { error } = await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject: 'Reset your password',
      html:
        `<p>We received a request to reset your password.</p>` +
        `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
        `<p>This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>`,
    });
    if (error) {
      this.logger.error(`Failed to send password reset email to ${to}: ${error.message}`);
      throw new Error(error.message);
    }
  }

  /**
   * Best-effort notification emails below — unlike sendOtp, failures here
   * are logged and swallowed rather than thrown, since they're side
   * notifications and must never abort the deal/scheduler flow that triggered them.
   */

  async sendShippedNotice(to: string, params: { sellerName: string; dealUrl: string }) {
    if (!this.resend) {
      this.logger.warn(`Email sending disabled — skipping shipped notice to ${to}`);
      return;
    }
    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: 'Your order has shipped',
        html:
          `<p>Good news — ${params.sellerName} has shipped your order.</p>` +
          `<p>You can check its status, confirm you've received it, or raise an issue any time here:</p>` +
          `<p><a href="${params.dealUrl}">${params.dealUrl}</a></p>`,
      });
      if (error) this.logger.error(`Failed to send shipped-notice email to ${to}: ${error.message}`);
    } catch (err) {
      this.logger.error(`Failed to send shipped-notice email to ${to}:`, err);
    }
  }

  async sendDeliveryReminder(to: string, params: { sellerName: string; dealUrl: string }) {
    if (!this.resend) {
      this.logger.warn(`Email sending disabled — skipping delivery reminder to ${to}`);
      return;
    }
    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: 'Did your order arrive?',
        html:
          `<p>Just checking in — if you've received your order from ${params.sellerName}, confirm receipt so they can get paid.</p>` +
          `<p>If something's wrong, let us know instead:</p>` +
          `<p><a href="${params.dealUrl}">${params.dealUrl}</a></p>` +
          `<p>If we don't hear from you soon, the payment will automatically release to the seller.</p>`,
      });
      if (error) this.logger.error(`Failed to send delivery-reminder email to ${to}: ${error.message}`);
    } catch (err) {
      this.logger.error(`Failed to send delivery-reminder email to ${to}:`, err);
    }
  }
}
