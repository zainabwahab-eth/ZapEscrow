import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup/start')
  signupStart(@Body() body: { email: string }) {
    return this.authService.initiateSignup(body.email);
  }

  @Post('signup/verify-otp')
  signupVerifyOtp(@Body() body: { email: string; code: string }) {
    return this.authService.verifyOtp(body.email, body.code);
  }

  @Post('signup/complete')
  signupComplete(@Body() body: { email: string; password: string; verifiedToken: string }) {
    return this.authService.completeSignup(body.email, body.password, body.verifiedToken);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }
}
