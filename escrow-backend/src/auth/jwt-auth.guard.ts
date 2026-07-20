import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface SessionPayload {
  sellerId: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Missing bearer token');

    try {
      const payload = this.jwtService.verify<Partial<SessionPayload>>(token);
      if (!payload.sellerId) throw new Error('Not a session token');
      request.sellerId = payload.sellerId;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
