import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { tap, type Observable } from 'rxjs';
import { clientIp } from '../common/client-ip.js';
import { record, str } from '../common/records.js';
import { matchActivity } from './activity-log.js';
import { ActivityLogService } from './activity-log.service.js';

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(private readonly activity: ActivityLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const rule = matchActivity(request.method, request.path || request.url);
    if (!rule || !request.caller) {
      return next.handle();
    }
    return next.handle().pipe(
      tap((data: unknown) => {
        const body = record(data) ?? {};
        const payload = record(body.data) ?? body;
        const entityId =
          str(payload, 'submission_id') ??
          str(payload, 'organization_id') ??
          str(payload, 'signatory_id') ??
          str(payload, 'sent_at') ??
          'N/A';
        const details = record(payload.activity_details);
        const entityName =
          str(details ?? {}, 'title_and_nature') ??
          str(payload, 'name') ??
          str(payload, 'content') ??
          'N/A';
        const description = describe(rule.action, entityId, entityName);
        void this.activity.write({
          sessionId:
            request.header('x-session-id') ?? request.caller?.sub ?? 'unknown',
          userId: request.caller?.sub ?? 'unknown',
          userName:
            request.caller?.name || request.caller?.email || 'Unknown User',
          userEmail: request.caller?.email || 'unknown@mapua.edu.ph',
          userRole: request.caller?.role || 'unknown',
          ipAddress: clientIp(request),
          actionType: rule.action,
          module: rule.module,
          entityId,
          entityName,
          description,
          organizationName: str(payload, 'organization_name') ?? 'N/A',
          after: request.body,
        });
      }),
    );
  }
}

function describe(
  action: string,
  entityId: string,
  entityName: string,
): string {
  if (action === 'SUBMISSION_APPROVE') {
    return `Approved submission ${entityId}`;
  }
  if (action === 'SUBMISSION_RETURN') {
    return `Returned submission ${entityId} for revision`;
  }
  if (action === 'SUBMISSION_DENY') {
    return `Denied submission ${entityId}`;
  }
  if (action === 'SUBMISSION_CREATE') {
    return `Submitted new event proposal${entityName === 'N/A' ? '' : ` '${entityName}'`} (${entityId})`;
  }
  if (action === 'SUBMISSION_UPDATE') {
    return `Updated submission${entityName === 'N/A' ? '' : ` '${entityName}'`} (${entityId})`;
  }
  return entityName === 'N/A'
    ? `${action} ${entityId}`
    : `${action} '${entityName}' (${entityId})`;
}
