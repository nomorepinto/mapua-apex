import { describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { HttpException } from '@nestjs/common';
import { CampusDto } from './dto/campus.dto.js';
import { CampusService } from './campus.service.js';
import type { CampusView } from './campus.repository.js';

type Item = Record<string, unknown>;

function dtoIssues(patch: Item): string[] {
  const instance = plainToInstance(
    CampusDto,
    { name: 'Intramuros Campus', ...patch },
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

describe('CampusDto departments/courses validation (C-1)', () => {
  const departments = [
    {
      code: 'EECE',
      name: 'Electrical, Electronics and Computer Engineering',
      courses: [
        { code: 'BSCpE', name: 'BS Computer Engineering' },
        { code: 'BSEE', name: 'BS Electrical Engineering' },
      ],
    },
  ];

  it('accepts departments with nested courses', () => {
    expect(dtoIssues({ departments })).toEqual([]);
  });

  it('leaves departments optional for pre-change campuses', () => {
    expect(dtoIssues({})).toEqual([]);
  });

  it('rejects a department without a code', () => {
    expect(
      dtoIssues({
        departments: [{ name: 'No code', courses: [] }],
      }).join('\n'),
    ).toContain('departments');
  });

  it('rejects a course without a name', () => {
    expect(
      dtoIssues({
        departments: [
          { code: 'EECE', name: 'EECE', courses: [{ code: 'BSCpE' }] },
        ],
      }).join('\n'),
    ).toContain('courses');
  });

  it('keeps departments through the whitelist used by the global pipe', () => {
    const instance = plainToInstance(
      CampusDto,
      { name: 'Intramuros Campus', departments },
      { exposeUnsetFields: false },
    );
    validateSync(instance, { whitelist: true });
    expect(instance.departments).toHaveLength(1);
    expect(instance.departments![0]!.courses).toHaveLength(2);
  });
});

/** Repository stub capturing the departments argument handed to create(). */
function build() {
  const created: { departments: unknown }[] = [];
  const campuses = {
    async list() {
      return [];
    },
    async get() {
      return undefined;
    },
    async create(
      _name: string,
      _prefixes: string[],
      _digits: number | null,
      _main: boolean,
      departments: unknown,
    ) {
      created.push({ departments });
      return {
        PK: 'CAMPUS#new',
        SK: 'CAMPUS#new',
        name: 'Intramuros Campus',
        departments,
      };
    },
  };
  const service = new CampusService(campuses as never);
  return { service, created };
}

async function rejection(promise: Promise<unknown>): Promise<HttpException> {
  return promise.then(
    () => {
      throw new Error('expected the write to be rejected');
    },
    (error) => error as HttpException,
  );
}

describe('CampusService departments validation (C-1)', () => {
  const base = { name: 'Intramuros Campus' };

  it('passes trimmed departments and courses through to the repository', async () => {
    const { service, created } = build();

    const view: CampusView = await service.create({
      ...base,
      departments: [
        {
          code: ' EECE ',
          name: ' Electrical, Electronics and Computer Engineering ',
          courses: [{ code: ' BSCpE ', name: ' BS Computer Engineering ' }],
        },
      ],
    } as never);

    expect(created).toHaveLength(1);
    expect(created[0]!.departments).toEqual([
      {
        code: 'EECE',
        name: 'Electrical, Electronics and Computer Engineering',
        courses: [{ code: 'BSCpE', name: 'BS Computer Engineering' }],
      },
    ]);
    expect(view.departments).toHaveLength(1);
  });

  it('rejects duplicate department codes (case-insensitive)', async () => {
    const { service } = build();

    const error = await rejection(
      service.create({
        ...base,
        departments: [
          { code: 'EECE', name: 'First', courses: [] },
          { code: 'eece', name: 'Second', courses: [] },
        ],
      } as never),
    );

    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toMatchObject({
      message: 'Duplicate department code "eece" on this campus.',
    });
  });

  it('rejects duplicate course codes within a department', async () => {
    const { service } = build();

    const error = await rejection(
      service.create({
        ...base,
        departments: [
          {
            code: 'EECE',
            name: 'EECE',
            courses: [
              { code: 'BSCpE', name: 'First' },
              { code: 'bscpe', name: 'Second' },
            ],
          },
        ],
      } as never),
    );

    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toMatchObject({
      message: 'Duplicate course code "bscpe" in department "EECE".',
    });
  });

  it('allows the same course code in different departments', async () => {
    const { service, created } = build();

    await service.create({
      ...base,
      departments: [
        {
          code: 'EECE',
          name: 'EECE',
          courses: [{ code: 'BSIT', name: 'BS IT' }],
        },
        {
          code: 'SOIT',
          name: 'SOIT',
          courses: [{ code: 'BSIT', name: 'BS IT' }],
        },
      ],
    } as never);

    expect(created).toHaveLength(1);
  });
});