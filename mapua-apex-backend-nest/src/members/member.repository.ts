import { Injectable } from '@nestjs/common';
import { DynamoTable } from '../aws/dynamo-table.js';
import {
  memberKey,
  organizationKey,
  stripPrefix,
} from '../common/dynamo-keys.js';
import { isConditionalCheckFailed, str, type Item } from '../common/records.js';
import { abort } from '../common/http.js';

export interface MemberView {
  student_number: string;
  lastname: string;
  firstname: string;
}

@Injectable()
export class MemberRepository {
  constructor(private readonly table: DynamoTable) {}

  async list(organizationId: string): Promise<MemberView[]> {
    const items = await this.table.query({
      keyCondition: 'PK = :pk AND begins_with(SK, :sk)',
      values: { ':pk': organizationKey(organizationId), ':sk': 'MEMBER#' },
    });
    return items.map((item) => toMember(item));
  }

  async get(
    organizationId: string,
    studentId: string,
  ): Promise<Item | undefined> {
    return this.table.get(
      organizationKey(organizationId),
      memberKey(studentId),
    );
  }

  async create(
    organizationId: string,
    member: MemberView,
  ): Promise<MemberView> {
    const item: Item = {
      PK: organizationKey(organizationId),
      SK: memberKey(member.student_number),
      student_number: member.student_number,
      lastname: member.lastname,
      firstname: member.firstname,
    };
    try {
      await this.table.put(item, 'attribute_not_exists(SK)');
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        abort(409, 'A member with this student number already exists.');
      }
      throw error;
    }
    return member;
  }

  async update(
    organizationId: string,
    studentId: string,
    lastname: string,
    firstname: string,
  ): Promise<MemberView> {
    const existing = await this.get(organizationId, studentId);
    if (!existing) {
      abort(404, 'Member not found.');
    }
    const item = await this.table.update({
      key: { PK: organizationKey(organizationId), SK: memberKey(studentId) },
      set: { lastname, firstname },
    });
    return toMember(item);
  }

  async remove(organizationId: string, studentId: string): Promise<void> {
    const existing = await this.get(organizationId, studentId);
    if (!existing) {
      abort(404, 'Member not found.');
    }
    await this.table.delete(
      organizationKey(organizationId),
      memberKey(studentId),
    );
  }

  async bulk(
    organizationId: string,
    members: MemberView[],
  ): Promise<{
    created: MemberView[];
    failed: { student_number: string; error: string }[];
  }> {
    const existing = new Set(
      (await this.list(organizationId)).map((member) => member.student_number),
    );
    const created: MemberView[] = [];
    const failed: { student_number: string; error: string }[] = [];
    const pending: Item[] = [];
    for (const member of members) {
      if (existing.has(member.student_number)) {
        failed.push({
          student_number: member.student_number,
          error: 'Already exists in this organization.',
        });
        continue;
      }
      existing.add(member.student_number);
      pending.push({
        PK: organizationKey(organizationId),
        SK: memberKey(member.student_number),
        student_number: member.student_number,
        lastname: member.lastname,
        firstname: member.firstname,
      });
      created.push(member);
    }
    if (pending.length > 0) {
      await this.table.batchPut(pending);
    }
    return { created, failed };
  }
}

function toMember(item: Item): MemberView {
  return {
    student_number:
      stripPrefix(item.SK, 'MEMBER#') ?? str(item, 'student_number') ?? '',
    lastname: str(item, 'lastname') ?? '',
    firstname: str(item, 'firstname') ?? '',
  };
}
