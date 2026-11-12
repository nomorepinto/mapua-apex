import { Injectable } from '@nestjs/common';
import { DynamoTable } from '../aws/dynamo-table.js';
import type { Item } from '../common/records.js';

export const TERM_KEY = 'OSAAR#TERM';

@Injectable()
export class TermSettingsRepository {
  constructor(private readonly table: DynamoTable) {}

  get(): Promise<Item | undefined> {
    return this.table.get(TERM_KEY, TERM_KEY);
  }

  put(item: Item): Promise<void> {
    return this.table.put(item);
  }
}
