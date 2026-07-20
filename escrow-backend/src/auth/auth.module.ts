import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SellersModule } from '../sellers/sellers.module';
import { EmailModule } from '../email/email.module';

const jwtModule = JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.get<string>('JWT_SECRET'),
    signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') },
  }),
});

@Module({
  imports: [forwardRef(() => SellersModule), EmailModule, jwtModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtAuthGuard, jwtModule],
})
export class AuthModule {}
