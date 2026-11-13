import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DynamoTable } from '../aws/dynamo-table.js';
import {
  campusKey,
  reservableKey,
  stripPrefix,
} from '../common/dynamo-keys.js';
import { num, record, str, type Item } from '../common/records.js';
import { isRoomType, type RoomType } from './room-types.js';
import { capacityLabel, normalizeSchedule, type Schedule } from './schedule.js';

export interface RoomEquipmentItem {
  name: string;
  quantity: number | null;
}

export interface ReservableView {
  reservable_id: string;
  campus_id: string;
  name: string;
  type: string;
  schedule: Schedule;
  min_participants: number | null;
  max_participants: number | null;
  capacity_label: string | null;
  /** Room category; null for equipment (and legacy rooms predating room_type). */
  room_type: RoomType | null;
  max_quantity: number | null;
  room_equipment: RoomEquipmentItem[];
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
    if (fields.type === 'room' && fields.roomType !== null) {
      item.room_type = fields.roomType;
    }
    if (fields.type === 'equipment' && fields.maxQuantity !== null) {
      item.max_quantity = fields.maxQuantity;
    }
    if (fields.type === 'room' && fields.roomEquipment.length > 0) {
      item.room_equipment = fields.roomEquipment;
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
  roomType: RoomType | null;
  maxQuantity: number | null;
  roomEquipment: RoomEquipmentItem[];
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
    room_type:
      type === 'room' && isRoomType(item.room_type) ? item.room_type : null,
    max_quantity: type === 'equipment' ? num(item, 'max_quantity') : null,
    room_equipment: type === 'room' ? toRoomEquipment(item.room_equipment) : [],
  };
}

function toRoomEquipment(value: unknown): RoomEquipmentItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: RoomEquipmentItem[] = [];
  for (const entry of value) {
    const item = record(entry);
    if (!item) {
      continue;
    }
    const name = str(item, 'name') ?? '';
    if (!name) {
      continue;
    }
    result.push({ name, quantity: num(item, 'quantity') });
  }
  return result;
}
