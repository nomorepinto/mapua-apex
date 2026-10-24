import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { abort } from '../common/http.js';
import { normalizePrefixes } from './classroom-naming.js';
import {
  CampusRepository,
  toCampus,
  type CampusView,
} from './campus.repository.js';
import type { CampusDto } from './dto/campus.dto.js';
import type { Item } from '../common/records.js';

@Injectable()
export class CampusService {
  constructor(private readonly campuses: CampusRepository) {}

  async list(): Promise<CampusView[]> {
    return (await this.campuses.list()).map((item) => toCampus(item));
  }

  async require(id: string): Promise<Item> {
    const item = await this.campuses.get(id);
    if (!item) {
      abort(404, 'The selected campus does not exist.');
    }
    return item;
  }

  async create(body: CampusDto): Promise<CampusView> {
    const { prefixes, digits } = this.pair(body);
    return toCampus(await this.campuses.create(body.name, prefixes, digits));
  }

  async update(id: string, body: CampusDto): Promise<CampusView> {
    const existing = await this.campuses.get(id);
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    const { prefixes, digits } = this.pair(body);
    return toCampus(
      await this.campuses.update(id, body.name, prefixes, digits),
    );
  }

  async remove(id: string): Promise<void> {
    const existing = await this.campuses.get(id);
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    if (await this.campuses.hasReservables(id)) {
      abort(
        409,
        'This campus still has rooms or equipment and cannot be deleted.',
      );
    }
    await this.campuses.delete(id);
  }

  private pair(body: CampusDto): { prefixes: string[]; digits: number | null } {
    const prefixes = normalizePrefixes(body.classroom_name_prefixes ?? []);
    const digits =
      body.classroom_name_digits === undefined ||
      body.classroom_name_digits === null
        ? null
        : body.classroom_name_digits;
    const prefixesPresent = prefixes.length > 0;
    const digitsPresent = digits !== null;
    if (prefixesPresent !== digitsPresent) {
      const field = digitsPresent
        ? 'classroom_name_prefixes'
        : 'classroom_name_digits';
      throw new UnprocessableEntityException({
        message:
          'The classroom name format needs both the prefix list and the digit count.',
        errors: {
          [field]: [
            'The classroom name format needs both the prefix list and the digit count.',
          ],
        },
      });
    }
    return { prefixes, digits };
  }
}
