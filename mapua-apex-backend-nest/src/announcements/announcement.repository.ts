import { Injectable } from '@nestjs/common';
import { DynamoTable } from '../aws/dynamo-table.js';
import { announcementPk, nowIso } from '../common/dynamo-keys.js';
import type { Item } from '../common/records.js';

@Injectable()
export class AnnouncementRepository {
  constructor(private readonly table: DynamoTable) {}

  async list(): Promise<Item[]> {
    const items = await this.table.query({
      keyCondition: 'PK = :pk',
      values: { ':pk': announcementPk() },
      scanForward: false,
    });
    return [...items].sort((left, right) =>
      String(right.SK).localeCompare(String(left.SK)),
    );
  }

  get(sentAt: string): Promise<Item | undefined> {
    return this.table.get(announcementPk(), sentAt);
  }

  async create(content: string): Promise<Item> {
    const item: Item = { PK: announcementPk(), SK: nowIso(), content };
    await this.table.put(item);
    return item;
  }

  async update(sentAt: string, content: string): Promise<Item> {
    const item: Item = { PK: announcementPk(), SK: sentAt, content };
    await this.table.put(item);
    return item;
  }

  delete(sentAt: string): Promise<void> {
    return this.table.delete(announcementPk(), sentAt);
  }
}
