import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Must run after JwtAuthGuard — relies on request.sellerEmail already being set from the decoded token. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const adminEmail = this.config.get<string>('ADMIN_EMAIL');
    const sellerEmail: string | undefined = request.sellerEmail;

    if (!adminEmail || !sellerEmail || sellerEmail.toLowerCase() !== adminEmail.toLowerCase()) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
