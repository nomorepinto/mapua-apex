import { Injectable } from '@nestjs/common';
import { DynamoTable } from '../aws/dynamo-table.js';
import { bookingKey, reservableKey } from '../common/dynamo-keys.js';
import type { Item } from '../common/records.js';

@Injectable()
export class BookingRepository {
  constructor(private readonly table: DynamoTable) {}

  list(reservableId: string): Promise<Item[]> {
    return this.table.query({
      keyCondition: 'PK = :pk AND begins_with(SK, :sk)',
      values: { ':pk': reservableKey(reservableId), ':sk': 'BOOKING#' },
    });
  }

  get(reservableId: string, bookingId: string): Promise<Item | undefined> {
    return this.table.get(reservableKey(reservableId), bookingKey(bookingId));
  }

  put(item: Item): Promise<void> {
    return this.table.put(item);
  }

  delete(reservableId: string, bookingId: string): Promise<void> {
    return this.table.delete(
      reservableKey(reservableId),
      bookingKey(bookingId),
    );
  }

  deleteKey(pk: string, sk: string): Promise<void> {
    return this.table.delete(pk, sk);
  }

  update(pk: string, sk: string, set: Record<string, unknown>): Promise<Item> {
    return this.table.update({ key: { PK: pk, SK: sk }, set });
  }
}
