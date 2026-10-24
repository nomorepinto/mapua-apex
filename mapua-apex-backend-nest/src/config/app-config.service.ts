import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SECRET_KEYS = [
  'ARCUS_SERVICE_TOKEN',
  'EMAILDETECTIVE_API_KEY',
  'GIBBERISH_API_KEY',
  'ORIGIN_VERIFY_SECRET',
] as const;

type SecretKey = (typeof SECRET_KEYS)[number];

/**
 * Typed view of process env, plus the four secrets that Lambda keeps in SSM.
 * Callers read secrets at request time so startup can finish loading them first.
 */
@Injectable()
export class AppConfigService implements OnModuleInit {
  private readonly secrets = new Map<SecretKey, string>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const names = SECRET_KEYS.flatMap((key) => {
      const name = this.optional(`${key}_PARAMETER`);
      return name ? [{ key, name }] : [];
    });
    if (names.length === 0) {
      return;
    }

    const client = new SSMClient(this.clientOptions(this.region()));
    try {
      for (const entry of names) {
        const result = await client.send(
          new GetParameterCommand({ Name: entry.name, WithDecryption: true }),
        );
        const value = result.Parameter?.Value ?? '';
        this.secrets.set(entry.key, value);
      }
    } finally {
      client.destroy();
    }
  }

  region(): string {
    return (
      this.optional('AWS_DEFAULT_REGION') ??
      this.optional('AWS_REGION') ??
      'us-east-1'
    );
  }

  cognitoRegion(): string {
    return this.optional('AWS_COGNITO_REGION') ?? this.region();
  }

  sesRegion(): string {
    return this.optional('AWS_SES_REGION') ?? this.region();
  }

  dynamoRegion(): string {
    return this.optional('AWS_DYNAMODB_REGION') ?? this.region();
  }

  dynamoTable(): string {
    return this.optional('AWS_DYNAMODB_TABLE') ?? '';
  }

  sessionLogTable(): string {
    return (
      this.optional('AWS_DYNAMODB_SESSION_LOG_TABLE') ?? this.dynamoTable()
    );
  }

  activityLogTable(): string {
    return (
      this.optional('AWS_DYNAMODB_ACTIVITY_LOG_TABLE') ?? this.dynamoTable()
    );
  }

  logRetentionDays(): number {
    return this.integer('LOG_RETENTION_DAYS', 90);
  }

  userPoolId(): string {
    return this.optional('AWS_COGNITO_USER_POOL_ID') ?? '';
  }

  cognitoClientId(): string {
    return this.optional('AWS_COGNITO_CLIENT_ID') ?? '';
  }

  accessKeyId(): string | undefined {
    return this.optional('AWS_ACCESS_KEY_ID');
  }

  secretAccessKey(): string | undefined {
    return this.optional('AWS_SECRET_ACCESS_KEY');
  }

  endpoint(): string | undefined {
    return this.optional('AWS_ENDPOINT');
  }

  dynamoEndpoint(): string | undefined {
    return this.optional('DYNAMODB_ENDPOINT') ?? this.endpoint();
  }

  cognitoEndpoint(): string | undefined {
    return this.optional('AWS_COGNITO_ENDPOINT') ?? this.endpoint();
  }

  appEnv(): string {
    return (
      this.optional('APP_ENV') ?? this.optional('NODE_ENV') ?? 'production'
    );
  }

  isLocalLike(): boolean {
    return ['local', 'testing', 'dev', 'test'].includes(this.appEnv());
  }

  /** Local-only override shared with the SPA. Deployed builds leave it off. */
  allowAnyEventDate(): boolean {
    return this.appEnv() === 'local' && this.flag('VITE_ALLOW_ANY_EVENT_DATE');
  }

  mailFromAddress(): string {
    return this.optional('MAIL_FROM_ADDRESS') ?? '';
  }

  corsOrigins(): string[] {
    const raw =
      this.optional('CORS_ALLOWED_ORIGINS') ??
      this.optional('FRONTEND_URL') ??
      'http://localhost:3000';
    return raw
      .split(',')
      .map((value) => value.trim().replace(/^['"]|['"]$/g, ''))
      .filter((value) => value !== '');
  }

  originVerifySecret(): string {
    return this.secret('ORIGIN_VERIFY_SECRET');
  }

  arcusServiceToken(): string {
    return this.secret('ARCUS_SERVICE_TOKEN');
  }

  arcusAttendanceUrl(): string {
    return (
      this.optional('ARCUS_ATTENDANCE_URL') ??
      this.optional('VITE_ARCUS_ATTENDANCE_URL') ??
      ''
    );
  }

  arcusEvaluationUrl(): string {
    return (
      this.optional('ARCUS_EVALUATION_URL') ??
      this.optional('VITE_ARCUS_EVALUATION_URL') ??
      ''
    );
  }

  postEvaluationWindowDays(): number {
    return this.integer('ARCUS_POST_EVALUATION_WINDOW_DAYS', 3);
  }

  emailDetectiveBaseUrl(): string {
    return (
      this.optional('EMAILDETECTIVE_BASE_URL') ??
      'https://api.emaildetective.io'
    );
  }

  emailDetectiveApiKey(): string {
    return this.secret('EMAILDETECTIVE_API_KEY');
  }

  gibberishEnabled(): boolean {
    return this.flag('GIBBERISH_CHECK_ENABLED');
  }

  gibberishBaseUrl(): string {
    return this.optional('GIBBERISH_API_URL') ?? '';
  }

  gibberishApiKey(): string {
    return this.secret('GIBBERISH_API_KEY');
  }

  gibberishVersion(): string {
    return this.optional('GIBBERISH_DETECTOR_VERSION') ?? '1';
  }

  gibberishCacheTtlSeconds(): number {
    return Math.max(60, this.integer('GIBBERISH_CACHE_TTL', 3600));
  }

  /**
   * Shared client options. Static keys are optional: Lambda uses the execution role.
   */
  clientOptions(
    region: string,
    endpoint?: string,
  ): {
    region: string;
    credentials?: { accessKeyId: string; secretAccessKey: string };
    endpoint?: string;
  } {
    const key = this.accessKeyId();
    const secret = this.secretAccessKey();
    return {
      region,
      ...(key && secret
        ? { credentials: { accessKeyId: key, secretAccessKey: secret } }
        : {}),
      ...(endpoint ? { endpoint } : {}),
    };
  }

  private secret(key: SecretKey): string {
    return this.secrets.get(key) ?? this.optional(key) ?? '';
  }

  private optional(key: string): string | undefined {
    const value = this.config.get<string>(key);
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  private flag(key: string): boolean {
    const value = (this.optional(key) ?? '').toLowerCase();
    return (
      value === '1' || value === 'true' || value === 'yes' || value === 'on'
    );
  }

  private integer(key: string, fallback: number): number {
    const raw = this.optional(key);
    if (raw === undefined) {
      return fallback;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
