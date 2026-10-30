import { Injectable } from '@nestjs/common';
import { DynamoTable } from '../aws/dynamo-table.js';
import { approvalSettingsKey, nowIso } from '../common/dynamo-keys.js';
import type { Item } from '../common/records.js';

export interface StoredOsaarStage {
  key: string;
  signatory_id: string;
}

@Injectable()
export class ApprovalSettingsRepository {
  constructor(private readonly table: DynamoTable) {}

  get(): Promise<Item | undefined> {
    const key = approvalSettingsKey();
    return this.table.get(key, key);
  }

  async save(stages: StoredOsaarStage[]): Promise<Item> {
    const key = approvalSettingsKey();
    const item: Item = {
      PK: key,
      SK: key,
      osaar_stages: stages,
      updated_at: nowIso(),
    };
    await this.table.put(item);
    return item;
  }
}
