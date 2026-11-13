import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { abort } from '../common/http.js';
import { stripPrefix } from '../common/dynamo-keys.js';
import { bool } from '../common/records.js';
import { normalizePrefixes } from './classroom-naming.js';
import {
  CampusRepository,
  toCampus,
  type CampusCourse,
  type CampusDepartment,
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
    const main = body.main === true;
    if (main) {
      await this.assertMainAvailable();
    }
    return toCampus(
      await this.campuses.create(
        body.name,
        prefixes,
        digits,
        main,
        this.departments(body),
      ),
    );
  }

  async update(id: string, body: CampusDto): Promise<CampusView> {
    const existing = await this.campuses.get(id);
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    const { prefixes, digits } = this.pair(body);
    const main = body.main === undefined ? bool(existing, 'main') : body.main;
    if (main && !bool(existing, 'main')) {
      await this.assertMainAvailable(id);
    }
    return toCampus(
      await this.campuses.update(
        id,
        body.name,
        prefixes,
        digits,
        main,
        this.departments(body),
      ),
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
    if (await this.campuses.hasAssignedOsaar(id)) {
      abort(
        409,
        'This campus still has OSAAR signatories and cannot be deleted.',
      );
    }
    await this.campuses.delete(id);
  }

  private async assertMainAvailable(exceptId?: string): Promise<void> {
    const except = exceptId ? stripPrefix(exceptId, 'CAMPUS#') : null;
    const holder = (await this.campuses.list()).find((item) => {
      if (!bool(item, 'main')) {
        return false;
      }
      return stripPrefix(item.PK, 'CAMPUS#') !== except;
    });
    if (holder) {
      abort(422, 'A main campus already exists.');
    }
  }

  /** Normalize + validate campus departments/courses (C-1): unique codes. */
  private departments(body: CampusDto): CampusDepartment[] {
    const result: CampusDepartment[] = [];
    const seenDepartments = new Set<string>();
    for (const dept of body.departments ?? []) {
      const code = dept.code.trim();
      const name = dept.name.trim();
      const key = code.toUpperCase();
      if (seenDepartments.has(key)) {
        abort(422, `Duplicate department code "${code}" on this campus.`);
      }
      seenDepartments.add(key);
      const courses: CampusCourse[] = [];
      const seenCourses = new Set<string>();
      for (const course of dept.courses ?? []) {
        const courseCode = course.code.trim();
        const courseName = course.name.trim();
        const courseKey = courseCode.toUpperCase();
        if (seenCourses.has(courseKey)) {
          abort(
            422,
            `Duplicate course code "${courseCode}" in department "${code}".`,
          );
        }
        seenCourses.add(courseKey);
        courses.push({ code: courseCode, name: courseName });
      }
      result.push({ code, name, courses });
    }
    return result;
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
