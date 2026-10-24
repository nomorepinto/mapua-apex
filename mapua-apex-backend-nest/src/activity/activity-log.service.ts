import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { DynamoTable } from '../aws/dynamo-table.js';
import { AppConfigService } from '../config/app-config.service.js';
import { nowIso } from '../common/dynamo-keys.js';
import type { Item } from '../common/records.js';
import { stripSecrets } from './activity-log.js';

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    private readonly table: DynamoTable,
    private readonly config: AppConfigService,
  ) {}

  async write(input: {
    sessionId: string;
    userId: string;
    userName: string;
    userEmail: string;
    userRole: string;
    ipAddress: string;
    actionType: string;
    module: string;
    entityId: string;
    entityName: string;
    description: string;
    organizationName: string;
    after: unknown;
  }): Promise<void> {
    try {
      const activityId = randomUUID();
      const timestamp = nowIso();
      const pk = `ACTIVITY#${activityId}`;
      const after = stripSecrets(input.after);
      const item: Item = {
        PK: pk,
        SK: pk,
        activityId,
        sessionId: input.sessionId,
        userId: input.userId,
        userName: input.userName,
        userEmail: input.userEmail,
        userRole: input.userRole,
        timestamp,
        ipAddress: input.ipAddress,
        actionType: input.actionType,
        module: input.module,
        entityId: input.entityId,
        entityName: input.entityName,
        organizationName: input.organizationName,
        description: input.description,
        TTL:
          Math.floor(Date.now() / 1000) +
          this.config.logRetentionDays() * 86400,
        GSI1PK: `SESSION#${input.sessionId}`,
        GSI1SK: timestamp,
        GSI2PK: `USER#${input.userId}`,
        GSI2SK: timestamp,
        GSI3PK: `DATE#${timestamp.slice(0, 10)}`,
        GSI3SK: timestamp,
        GSI4PK: `MODULE#${input.module}`,
        GSI4SK: timestamp,
      };
      if (after && typeof after === 'object' && Object.keys(after).length > 0) {
        item.after = after;
      }
      await this.table.put(item, undefined, this.config.activityLogTable());
    } catch (error) {
      this.logger.warn(
        `Activity log skipped: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
