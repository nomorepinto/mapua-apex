import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CampusRepository, toCampus } from '../campuses/campus.repository.js';
import {
  matchesClassroom,
  normalizePrefixes,
} from '../campuses/classroom-naming.js';
import { abort } from '../common/http.js';
import { num, type Item } from '../common/records.js';
import type { ReservableDto } from './dto/reservable.dto.js';
import {
  ReservableRepository,
  toReservable,
  type ReservableView,
  type ReservableWrite,
} from './reservable.repository.js';
import { DAYS, normalizeSchedule, SLOT_COUNT } from './schedule.js';

@Injectable()
export class ReservableService {
  constructor(
    private readonly reservables: ReservableRepository,
    private readonly campuses: CampusRepository,
  ) {}

  async list(campusId: string): Promise<ReservableView[]> {
    await this.requireCampus(campusId);
    return (await this.reservables.list(campusId)).map((item) =>
      toReservable(item),
    );
  }

  async create(campusId: string, body: ReservableDto): Promise<ReservableView> {
    const campus = await this.requireCampus(campusId);
    const fields = this.checked(body, campus);
    return toReservable(await this.reservables.create(campusId, fields));
  }

  async update(
    campusId: string,
    reservableId: string,
    body: ReservableDto,
  ): Promise<ReservableView> {
    const existing = await this.reservables.get(campusId, reservableId);
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    const campus = await this.campuses.get(campusId);
    const fields = this.checked(body, campus ?? {});
    return toReservable(
      await this.reservables.update(campusId, reservableId, fields),
    );
  }

  async remove(campusId: string, reservableId: string): Promise<void> {
    const existing = await this.reservables.get(campusId, reservableId);
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    if (await this.reservables.hasBookings(reservableId)) {
      abort(
        409,
        'This room or equipment still has bookings and cannot be deleted.',
      );
    }
    await this.reservables.delete(campusId, reservableId);
  }

  async require(campusId: string, reservableId: string): Promise<Item> {
    const item = await this.reservables.get(campusId, reservableId);
    if (!item) {
      abort(404, 'The selected room or equipment does not exist.');
    }
    return item;
  }

  private async requireCampus(campusId: string): Promise<Item> {
    const campus = await this.campuses.get(campusId);
    if (!campus) {
      abort(404, 'The selected campus does not exist.');
    }
    return campus;
  }

  private checked(body: ReservableDto, campus: Item): ReservableWrite {
    this.assertSchedule(body.schedule);
    const min = body.min_participants ?? null;
    const max = body.max_participants ?? null;
    if (min !== null && max !== null && min > max) {
      throw new UnprocessableEntityException({
        message: 'The minimum participants cannot exceed the maximum.',
        errors: {
          min_participants: [
            'The minimum participants cannot exceed the maximum.',
          ],
        },
      });
    }
    if (body.type === 'room' && body.max_quantity != null) {
      throw new UnprocessableEntityException({
        message: 'max_quantity only applies to equipment, not rooms.',
        errors: {
          max_quantity: ['max_quantity only applies to equipment, not rooms.'],
        },
      });
    }
    const classroom = body.type === 'room' && body.is_classroom === true;
    if (classroom) {
      const view = toCampus(campus);
      const prefixes = normalizePrefixes(view.classroom_name_prefixes);
      const digits = num(campus, 'classroom_name_digits');
      if (prefixes.length === 0 || digits === null) {
        throw new UnprocessableEntityException({
          message: 'This campus has no classroom name format configured yet.',
          errors: {
            is_classroom: [
              'This campus has no classroom name format configured yet.',
            ],
          },
        });
      }
      if (!matchesClassroom(prefixes, digits, body.name)) {
        const message = `A classroom room must be named with one of ${prefixes.join(', ')} followed by exactly ${digits} digits.`;
        throw new UnprocessableEntityException({
          message,
          errors: { name: [message] },
        });
      }
    }
    return {
      name: body.name,
      type: body.type,
      schedule: normalizeSchedule(body.schedule),
      min,
      max,
      isClassroom: classroom,
      maxQuantity:
        body.type === 'equipment' ? (body.max_quantity ?? null) : null,
    };
  }

  private assertSchedule(schedule: Record<string, boolean[]>): void {
    const errors: Record<string, string[]> = {};
    for (const day of DAYS) {
      const row = schedule[day];
      if (row === undefined) {
        continue;
      }
      if (
        !Array.isArray(row) ||
        row.length !== SLOT_COUNT ||
        row.some((slot) => typeof slot !== 'boolean')
      ) {
        errors[`schedule.${day}`] = [
          `The schedule.${day} field must contain 12 booleans.`,
        ];
      }
    }
    if (Object.keys(errors).length > 0) {
      const first =
        Object.values(errors)[0]?.[0] ?? 'The given data was invalid.';
      throw new UnprocessableEntityException({ message: first, errors });
    }
  }
}
