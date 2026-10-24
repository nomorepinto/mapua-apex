import { Injectable } from '@nestjs/common';
import { DynamoTable } from '../aws/dynamo-table.js';
import {
  eventKey,
  organizationKey,
  postEvalKey,
  studentKey,
} from '../common/dynamo-keys.js';
import type { Item } from '../common/records.js';

@Injectable()
export class PostEvalRepository {
  constructor(private readonly table: DynamoTable) {}

  listForEvent(eventId: string, prefix: string): Promise<Item[]> {
    return this.table.query({
      keyCondition: 'PK = :pk AND begins_with(SK, :sk)',
      values: { ':pk': eventKey(eventId), ':sk': prefix },
    });
  }

  listOrg(organizationId: string): Promise<Item[]> {
    return this.table.query({
      index: 'GSI1',
      keyCondition: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      values: { ':pk': organizationKey(organizationId), ':sk': 'POSTEVAL#' },
    });
  }

  get(eventId: string, postEvalId: string): Promise<Item | undefined> {
    return this.table.get(eventKey(eventId), postEvalKey(postEvalId));
  }

  put(item: Item): Promise<void> {
    return this.table.put(item, 'attribute_not_exists(SK)');
  }

  update(
    eventId: string,
    postEvalId: string,
    set: Record<string, unknown>,
  ): Promise<Item> {
    return this.table.update({
      key: { PK: eventKey(eventId), SK: postEvalKey(postEvalId) },
      set,
    });
  }

  async profiles(studentIds: string[]): Promise<Map<string, Item>> {
    const keys = studentIds
      .filter((id) => id !== '')
      .map((id) => {
        const key = studentKey(id);
        return { PK: key, SK: key };
      });
    const rows = keys.length === 0 ? [] : await this.table.batchGet(keys);
    const map = new Map<string, Item>();
    for (const row of rows) {
      const id = String(row.PK).startsWith('STUDENT#')
        ? String(row.PK).slice('STUDENT#'.length)
        : '';
      if (id) {
        map.set(id, row);
      }
    }
    return map;
  }
}
