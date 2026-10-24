import { Injectable } from '@nestjs/common';
import { nowIso, stripPrefix } from '../common/dynamo-keys.js';
import { str, type Item } from '../common/records.js';
import { SubmissionRepository } from '../submissions/submission.repository.js';

@Injectable()
export class DeadlineService {
  constructor(private readonly submissions: SubmissionRepository) {}

  async list(organizationId: string): Promise<Item[]> {
    const now = nowIso();
    const events = await this.submissions.listOrgEvents(organizationId, 25);
    const deadlines: Item[] = [];
    for (const event of events) {
      const eventId = stripPrefix(event.PK, 'EVENT#');
      if (!eventId || !String(event.PK).startsWith('EVENT#')) {
        continue;
      }
      const rows = await this.submissions.listDeadlines(eventId);
      for (const row of rows) {
        const deadline = str(row, 'deadline');
        if (deadline && deadline >= now) {
          deadlines.push({
            event_id: eventId,
            deadline_id: stripPrefix(row.SK, 'DEADLINE#'),
            sent_at: str(row, 'sent_at'),
            deadline,
          });
        }
      }
    }
    return deadlines.sort((left, right) =>
      String(left.deadline).localeCompare(String(right.deadline)),
    );
  }
}
