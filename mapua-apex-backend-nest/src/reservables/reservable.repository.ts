import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DynamoTable } from '../aws/dynamo-table.js';
import {
  campusKey,
  reservableKey,
  stripPrefix,
} from '../common/dynamo-keys.js';
import { bool, num, str, type Item } from '../common/records.js';
import { capacityLabel, normalizeSchedule, type Schedule } from './schedule.js';

export interface ReservableView {
  reservable_id: string;
  campus_id: string;
  name: string;
  type: string;
  schedule: Schedule;
  min_participants: number | null;
  max_participants: number | null;
  capacity_label: string | null;
  is_classroom: boolean;
  max_quantity: number | null;
}

@Injectable()
export class ReservableRepository {
  constructor(private readonly table: DynamoTable) {}

  list(campusId: string): Promise<Item[]> {
    return this.table.query({
      keyCondition: 'PK = :pk AND begins_with(SK, :sk)',
      values: { ':pk': campusKey(campusId), ':sk': 'RESERVABLE#' },
    });
  }

  async find(reservableId: string): Promise<Item | undefined> {
    const items = await this.table.scan({
      filter: 'SK = :sk AND begins_with(PK, :pk)',
      values: { ':sk': reservableKey(reservableId), ':pk': 'CAMPUS#' },
      maxItems: 1,
    });
    return items[0];
  }

  get(campusId: string, reservableId: string): Promise<Item | undefined> {
    return this.table.get(campusKey(campusId), reservableKey(reservableId));
  }

  async create(campusId: string, fields: ReservableWrite): Promise<Item> {
    return this.write(campusId, randomUUID(), fields);
  }

  update(
    campusId: string,
    reservableId: string,
    fields: ReservableWrite,
  ): Promise<Item> {
    return this.write(
      campusId,
      stripPrefix(reservableId, 'RESERVABLE#') ?? reservableId,
      fields,
    );
  }

  delete(campusId: string, reservableId: string): Promise<void> {
    return this.table.delete(campusKey(campusId), reservableKey(reservableId));
  }

  async hasBookings(reservableId: string): Promise<boolean> {
    const items = await this.table.query({
      keyCondition: 'PK = :pk AND begins_with(SK, :sk)',
      values: { ':pk': reservableKey(reservableId), ':sk': 'BOOKING#' },
      limit: 1,
      allPages: false,
    });
    return items.length > 0;
  }

  private async write(
    campusId: string,
    id: string,
    fields: ReservableWrite,
  ): Promise<Item> {
    const item: Item = {
      PK: campusKey(campusId),
      SK: reservableKey(id),
      name: fields.name,
      type: fields.type,
      schedule: fields.schedule,
    };
    if (
      fields.type === 'room' &&
      (fields.min !== null || fields.max !== null)
    ) {
      item.min_participants = fields.min;
      item.max_participants = fields.max;
    }
    if (fields.type === 'room' && fields.isClassroom) {
      item.is_classroom = true;
    }
    if (fields.type === 'equipment' && fields.maxQuantity !== null) {
      item.max_quantity = fields.maxQuantity;
    }
    await this.table.put(item);
    return item;
  }
}

export interface ReservableWrite {
  name: string;
  type: 'room' | 'equipment';
  schedule: Schedule;
  min: number | null;
  max: number | null;
  isClassroom: boolean;
  maxQuantity: number | null;
}

export function toReservable(item: Item): ReservableView {
  const type = (str(item, 'type') ?? '').toLowerCase();
  const min = type === 'room' ? num(item, 'min_participants') : null;
  const max = type === 'room' ? num(item, 'max_participants') : null;
  return {
    reservable_id: stripPrefix(item.SK, 'RESERVABLE#') ?? '',
    campus_id: stripPrefix(item.PK, 'CAMPUS#') ?? '',
    name: str(item, 'name') ?? '',
    type,
    schedule: normalizeSchedule(item.schedule),
    min_participants: min,
    max_participants: max,
    capacity_label: type === 'room' ? capacityLabel(min, max) : null,
    is_classroom: type === 'room' && bool(item, 'is_classroom'),
    max_quantity: type === 'equipment' ? num(item, 'max_quantity') : null,
  };
}
