import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { eventKey, memberKey, stripPrefix } from '../common/dynamo-keys.js';
import { abort } from '../common/http.js';
import { eventWindow, type VisibilityWindow } from '../common/manila.js';
import { record, str, type Item } from '../common/records.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { PostEvalRepository } from '../postevals/posteval.repository.js';
import { PostEvalService } from '../postevals/posteval.service.js';
import { submissionKey } from '../common/dynamo-keys.js';
import { SubmissionRepository } from '../submissions/submission.repository.js';
import { DynamoTable } from '../aws/dynamo-table.js';

@Injectable()
export class ArcusService {
  constructor(
    private readonly submissions: SubmissionRepository,
    private readonly organizations: OrganizationRepository,
    private readonly postevals: PostEvalService,
    private readonly postevalRows: PostEvalRepository,
    private readonly table: DynamoTable,
    private readonly config: AppConfigService,
  ) {}

  async events(
    organizationId: string | null,
    window: 'attendance' | 'evaluation',
  ): Promise<Item[]> {
    const orgs = organizationId
      ? [await this.organizations.get(organizationId)].filter(
          (org): org is Item => Boolean(org),
        )
      : await this.organizations.list();
    const seen = new Set<string>();
    const published: Item[] = [];
    for (const org of orgs) {
      const id = stripPrefix(org.PK, 'ORGANIZATION#') ?? '';
      const name = str(org, 'name');
      for (const status of ['approved', 'finished']) {
        for (const item of await this.submissions.listOrgSubmissions(id)) {
          if (str(item, 'status') !== status) {
            continue;
          }
          const key = `${item.PK}\0${item.SK}`;
          if (seen.has(key) || !this.open(item, window)) {
            continue;
          }
          seen.add(key);
          published.push(
            this.eventView(name ? { ...item, organization_name: name } : item),
          );
        }
      }
    }
    return published;
  }

  async studentEvents(
    studentId: string,
    window: 'attendance' | 'evaluation',
  ): Promise<Item[]> {
    const trimmed = studentId.trim();
    if (trimmed === '') {
      abort(400, 'A student id is required.');
    }
    const events = await this.events(null, window);
    const keys = events
      .map((event) => str(event, 'event_id'))
      .filter((id): id is string => Boolean(id))
      .map((id) => ({ PK: eventKey(id), SK: memberKey(trimmed) }));
    const attended = new Set(
      (await this.table.batchGet(keys)).map((row) => String(row.PK)),
    );
    return events.filter((event) =>
      attended.has(eventKey(str(event, 'event_id') ?? '')),
    );
  }

  async postEval(
    eventId: string,
    organizationId: string | null,
  ): Promise<Item> {
    const trimmed = eventId.trim();
    if (trimmed === '') {
      abort(400, 'An event id is required.');
    }
    const context = await this.context(trimmed);
    if (!context.submission) {
      abort(404, 'Event not found.');
    }
    if (
      organizationId &&
      context.submission.GSI1PK !== `ORGANIZATION#${organizationId}`
    ) {
      abort(403, 'This event belongs to another organization.');
    }
    const aggregate = await this.postevals.participants(trimmed);
    const filing = context.postEval;
    return {
      event_id: trimmed,
      submission_id: stripPrefix(context.submission.SK, 'SUBMISSION#'),
      organization_id: stripPrefix(context.submission.GSI1PK, 'ORGANIZATION#'),
      ...aggregate,
      post_eval: filing
        ? {
            posteval_id: stripPrefix(filing.SK, 'POSTEVAL#'),
            status: str(filing, 'status') ?? 'none',
            submitted_at: str(filing, 'submitted_at'),
            approved_at: str(filing, 'approved_at'),
            denied_at: str(filing, 'denied_at'),
          }
        : {
            posteval_id: null,
            status: 'none',
            submitted_at: null,
            approved_at: null,
            denied_at: null,
          },
    };
  }

  private async context(
    eventId: string,
  ): Promise<{ submission: Item | null; postEval: Item | null }> {
    const submissions = await this.postevalRows.listForEvent(
      eventId,
      'SUBMISSION#',
    );
    submissions.sort((left, right) => compareSubmission(right, left));
    const byKey = new Map(submissions.map((item) => [String(item.SK), item]));
    const filings = (
      await this.postevalRows.listForEvent(eventId, 'POSTEVAL#')
    ).filter((item) =>
      byKey.has(submissionKey(str(item, 'submission_id') ?? '')),
    );
    filings.sort((left, right) => compareFiling(right, left));
    const postEval = filings[0] ?? null;
    const submission = postEval
      ? (byKey.get(submissionKey(str(postEval, 'submission_id') ?? '')) ?? null)
      : (submissions[0] ?? null);
    return { submission, postEval };
  }

  private open(item: Item, window: 'attendance' | 'evaluation'): boolean {
    const date = str(record(item.activity_details) ?? {}, 'date_of_event');
    return eventWindow(date, window, this.config.postEvaluationWindowDays())
      .is_open;
  }

  private eventView(item: Item): Item {
    const details = record(item.activity_details) ?? {};
    const date = str(details, 'date_of_event');
    const days = this.config.postEvaluationWindowDays();
    const attendance: VisibilityWindow = eventWindow(date, 'attendance', days);
    const evaluation: VisibilityWindow = eventWindow(date, 'evaluation', days);
    return {
      event_id: stripPrefix(item.PK, 'EVENT#'),
      submission_id: stripPrefix(item.SK, 'SUBMISSION#'),
      organization_id: stripPrefix(item.GSI1PK, 'ORGANIZATION#'),
      organization_name: str(item, 'organization_name'),
      status: str(item, 'status'),
      title: str(details, 'title_and_nature'),
      venue: str(details, 'venue'),
      date_of_event: date,
      day_of_event: str(details, 'day_of_event'),
      time_of_event: str(details, 'time_of_event'),
      finished_at: str(item, 'finished_at'),
      attendance,
      evaluation,
    };
  }
}

function compareSubmission(left: Item, right: Item): number {
  const leftApproved =
    str(left, 'status') === 'approved' || str(left, 'status') === 'finished';
  const rightApproved =
    str(right, 'status') === 'approved' || str(right, 'status') === 'finished';
  if (leftApproved !== rightApproved) {
    return leftApproved ? 1 : -1;
  }
  return String(left.sent_at ?? '').localeCompare(String(right.sent_at ?? ''));
}

function compareFiling(left: Item, right: Item): number {
  const active = (item: Item): boolean =>
    str(item, 'status') === 'submitted' || str(item, 'status') === 'approved';
  if (active(left) !== active(right)) {
    return active(left) ? 1 : -1;
  }
  return String(left.submitted_at ?? '').localeCompare(
    String(right.submitted_at ?? ''),
  );
}
