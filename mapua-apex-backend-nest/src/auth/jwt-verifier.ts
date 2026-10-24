import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  FetchError,
  JwksNotAvailableInCacheError,
  NonRetryableFetchError,
} from 'aws-jwt-verify/error';
import { AppConfigService } from '../config/app-config.service.js';

export interface JwtVerifier {
  verify(token: string): Promise<Record<string, unknown>>;
}

export const JWT_VERIFIER = Symbol('JWT_VERIFIER');

@Injectable()
export class AwsCognitoJwtVerifier implements JwtVerifier {
  private verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;

  constructor(private readonly config: AppConfigService) {}

  async verify(token: string): Promise<Record<string, unknown>> {
    const poolId = this.config.userPoolId();
    const clientId = this.config.cognitoClientId();
    if (poolId === '' || clientId === '') {
      throw new UnauthorizedException(
        'Unauthenticated: Invalid Cognito token (Identity provider is not configured.).',
      );
    }
    try {
      this.verifier ??= CognitoJwtVerifier.create({
        userPoolId: poolId,
        clientId,
        tokenUse: null,
        graceSeconds: 60,
      });
      const payload = await this.verifier.verify(token);
      return payload as Record<string, unknown>;
    } catch (error) {
      if (
        error instanceof FetchError ||
        error instanceof NonRetryableFetchError ||
        error instanceof JwksNotAvailableInCacheError
      ) {
        throw new ServiceUnavailableException('Identity provider unavailable.');
      }
      if (
        error instanceof UnauthorizedException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      const detail = error instanceof Error ? error.message : 'Invalid token.';
      throw new UnauthorizedException(
        `Unauthenticated: Invalid Cognito token (${detail}).`,
      );
    }
  }
}
