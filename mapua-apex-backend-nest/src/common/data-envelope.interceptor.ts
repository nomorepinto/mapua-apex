import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';
import { NO_ENVELOPE } from './decorators.js';

/** Wraps handler results in `{ data }` unless the route opts out. */
@Injectable()
export class DataEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(NO_ENVELOPE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }
    return next.handle().pipe(
      map((data: unknown) => {
        if (data === undefined) {
          return data;
        }
        return { data };
      }),
    );
  }
}
