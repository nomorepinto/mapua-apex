import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigModule } from '../config/app-config.module.js';
import { SessionsModule } from '../sessions/sessions.module.js';
import { OriginVerifyGuard } from '../common/origin-verify.guard.js';
import { ActiveSessionGuard } from './active-session.guard.js';
import { ArcusServiceGuard } from './arcus-service.guard.js';
import { CognitoAuthGuard } from './cognito-auth.guard.js';
import { AwsCognitoJwtVerifier, JWT_VERIFIER } from './jwt-verifier.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [AppConfigModule, SessionsModule],
  providers: [
    AwsCognitoJwtVerifier,
    { provide: JWT_VERIFIER, useExisting: AwsCognitoJwtVerifier },
    { provide: APP_GUARD, useClass: OriginVerifyGuard },
    { provide: APP_GUARD, useClass: CognitoAuthGuard },
    { provide: APP_GUARD, useClass: ArcusServiceGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ActiveSessionGuard },
  ],
  exports: [JWT_VERIFIER],
})
export class AuthModule {}
