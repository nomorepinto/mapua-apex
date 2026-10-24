import { stripPrefix } from '../common/dynamo-keys.js';
import { str, type Item } from '../common/records.js';

export interface ParticipantAggregate {
  attendance_count: number;
  attendance: Item[];
  evaluation_count: number;
  evaluations: Item[];
}

export function aggregateParticipants(
  rows: Item[],
  profiles: Map<string, Item>,
): ParticipantAggregate {
  const attendance: Item[] = [];
  const evaluations: Item[] = [];
  for (const row of rows) {
    const sk = String(row.SK ?? '');
    if (sk.startsWith('MEMBER#')) {
      const studentId = stripPrefix(sk, 'MEMBER#') ?? '';
      const profile = profiles.get(studentId) ?? {};
      attendance.push({
        student_id: str(profile, 'student_id') ?? studentId,
        full_name: str(profile, 'full_name') ?? '',
        department: str(profile, 'department') ?? '',
        member_organization: str(row, 'member_organization') ?? '',
        scanned_at: str(row, 'scannedAt') ?? '',
        left_at: str(row, 'leftAt') ?? '',
      });
    } else if (sk.startsWith('EVALUATION#')) {
      evaluations.push({
        evaluation_id:
          str(row, 'evaluationId') ??
          str(row, 'evaluation_id') ??
          stripPrefix(sk, 'EVALUATION#') ??
          '',
        student_id: str(row, 'studentId') ?? str(row, 'student_id') ?? '',
        full_name: str(row, 'fullName') ?? str(row, 'full_name') ?? '',
        participated: participatedFlag(row.participated),
        filed_at: str(row, 'filedAt') ?? str(row, 'filed_at') ?? '',
      });
    }
  }
  return {
    attendance_count: attendance.length,
    attendance,
    evaluation_count: evaluations.length,
    evaluations,
  };
}

function participatedFlag(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return typeof value === 'string' && value.toLowerCase() === 'yes';
}
