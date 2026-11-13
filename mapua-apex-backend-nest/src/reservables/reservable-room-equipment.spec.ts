import { describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { HttpException } from '@nestjs/common';
import { ReservableDto } from './dto/reservable.dto.js';
import { ReservableService } from './reservable.service.js';
import { DAYS, SLOT_COUNT } from './schedule.js';

type Item = Record<string, unknown>;

const schedule = Object.fromEntries(
  DAYS.map((day) => [day, Array<boolean>(SLOT_COUNT).fill(true)]),
);

function dtoIssues(patch: Item): string[] {
  const instance = plainToInstance(
    ReservableDto,
    { name: 'N101', type: 'room', schedule, ...patch },
    { exposeUnsetFields: false },
  );
  const found: string[] = [];
  const walk = (
    errors: ReturnType<typeof validateSync>,
    path: string,
  ): void => {
    for (const error of errors) {
      const key = path ? `${path}.${error.property}` : error.property;
      if (error.constraints)
        found.push(`${key}: ${JSON.stringify(error.constraints)}`);
      if (error.children?.length) walk(error.children, key);
    }
  };
  walk(validateSync(instance, { whitelist: true }), '');
  return found;
}

describe('ReservableDto room_equipment validation (S-8)', () => {
  it('accepts room equipment with optional quantities', () => {
    expect(
      dtoIssues({
        room_equipment: [
          { name: 'Projector', quantity: 1 },
          { name: 'Whiteboard markers' },
        ],
      }),
    ).toEqual([]);
  });

  it('leaves room_equipment optional for pre-change reservables', () => {
    expect(dtoIssues({})).toEqual([]);
  });

  it('rejects an item without a name', () => {
    expect(
      dtoIssues({ room_equipment: [{ quantity: 2 }] }).join('\n'),
    ).toContain('room_equipment');
  });

  it('rejects a zero quantity', () => {
    expect(
      dtoIssues({ room_equipment: [{ name: 'Projector', quantity: 0 }] }).join(
        '\n',
      ),
    ).toContain('room_equipment');
  });
});

/** Repository/campus stubs capturing the checked write payload. */
function build() {
  const writes: Item[] = [];
  const reservables = {
    async create(_campusId: string, fields: Item) {
      writes.push(fields);
      return {
        PK: 'CAMPUS#c',
        SK: 'RESERVABLE#new',
        name: fields.name,
        type: fields.type,
        room_equipment: fields.roomEquipment,
      };
    },
    async get() {
      return undefined;
    },
  };
  const campuses = {
    async get() {
      return { PK: 'CAMPUS#c', SK: 'CAMPUS#c', name: 'Intramuros Campus' };
    },
  };
  const service = new ReservableService(
    reservables as never,
    campuses as never,
  );
  return { service, writes };
}

async function rejection(promise: Promise<unknown>): Promise<HttpException> {
  return promise.then(
    () => {
      throw new Error('expected the write to be rejected');
    },
    (error) => error as HttpException,
  );
}

describe('ReservableService room_equipment rules (S-8)', () => {
  it('persists room equipment on a room, trimming names', async () => {
    const { service, writes } = build();

    await service.create('c', {
      name: 'N101',
      type: 'room',
      room_type: 'function_room',
      schedule,
      room_equipment: [{ name: ' Projector ', quantity: 2 }],
    } as never);

    expect(writes[0]!.roomEquipment).toEqual([
      { name: 'Projector', quantity: 2 },
    ]);
  });

  it('defaults a missing quantity to null', async () => {
    const { service, writes } = build();

    await service.create('c', {
      name: 'N101',
      type: 'room',
      room_type: 'function_room',
      schedule,
      room_equipment: [{ name: 'Podium' }],
    } as never);

    expect(writes[0]!.roomEquipment).toEqual([
      { name: 'Podium', quantity: null },
    ]);
  });

  it('rejects room_equipment on campus equipment', async () => {
    const { service } = build();

    const error = await rejection(
      service.create('c', {
        name: 'Portable speaker',
        type: 'equipment',
        schedule,
        max_quantity: 3,
        room_equipment: [{ name: 'Projector' }],
      } as never),
    );

    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toMatchObject({
      message: 'room_equipment only applies to rooms, not equipment.',
    });
  });

  it('rejects a room equipment item with a blank name', async () => {
    const { service } = build();

    const error = await rejection(
      service.create('c', {
        name: 'N101',
        type: 'room',
        room_type: 'function_room',
        schedule,
        room_equipment: [{ name: '   ' }],
      } as never),
    );

    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toMatchObject({
      message: 'Each room equipment item needs a name.',
    });
  });
});