import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface SessionBody {
  error: string;
  code?: string;
}

function isSessionBody(value: object): value is SessionBody {
  if (!('error' in value) || typeof (value as SessionBody).error !== 'string') {
    return false;
  }
  // Nest's own HttpException body also has `error` ("Not Found") plus `message`.
  // Session responses are `{ error, code? }` with no message.
  return !('message' in value);
}

/**
 * Every error the SPA reads is `{ message }` (Laravel) or `{ error, code }`
 * (session lifecycle). AWS names and stacks stay in the log.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = this.toBody(exception);
    if (mapped.status >= 500 && !(exception instanceof HttpException)) {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Unhandled error',
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    response.status(mapped.status).json(mapped.body);
  }

  private toBody(exception: unknown): {
    status: number;
    body: Record<string, unknown>;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      if (typeof raw === 'string') {
        return { status, body: { message: raw } };
      }
      if (typeof raw === 'object' && raw !== null) {
        if (isSessionBody(raw)) {
          const body: Record<string, unknown> = { error: raw.error };
          if (raw.code) {
            body.code = raw.code;
          }
          return { status, body };
        }
        const record = raw as { message?: string | string[]; errors?: unknown };
        const message = Array.isArray(record.message)
          ? record.message[0]
          : (record.message ?? exception.message);
        const body: Record<string, unknown> = { message };
        if (record.errors) {
          body.errors = record.errors;
        }
        return { status, body };
      }
      return { status, body: { message: exception.message } };
    }

    const name = exception instanceof Error ? exception.name : '';
    if (name === 'ConditionalCheckFailedException') {
      return {
        status: HttpStatus.CONFLICT,
        body: { message: 'The request conflicted with existing data.' },
      };
    }
    if (name === 'TransactionCanceledException') {
      const reasons =
        (exception as { CancellationReasons?: { Code?: string }[] })
          .CancellationReasons ?? [];
      const conditional = reasons.some(
        (reason) => reason.Code === 'ConditionalCheckFailed',
      );
      if (conditional) {
        return {
          status: HttpStatus.CONFLICT,
          body: { message: 'The request conflicted with existing data.' },
        };
      }
    }
    if (
      name === 'ProvisionedThroughputExceededException' ||
      name === 'ThrottlingException' ||
      name === 'RequestLimitExceeded' ||
      name === 'TooManyRequestsException'
    ) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        body: { message: 'Service temporarily unavailable.' },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { message: 'Server Error' },
    };
  }
}
