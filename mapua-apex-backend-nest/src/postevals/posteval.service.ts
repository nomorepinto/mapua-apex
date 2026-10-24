import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../config/app-config.service.js';
import {
  eventKey,
  nowIso,
  organizationKey,
  postEvalKey,
  stripPrefix,
} from '../common/dynamo-keys.js';
import { abort } from '../common/http.js';
import { eventWindow } from '../common/manila.js';
import { record, str, type Item } from '../common/records.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { SubmissionRepository } from '../submissions/submission.repository.js';
import {
  aggregateParticipants,
  type ParticipantAggregate,
} from './participants.js';
import { PostEvalRepository } from './posteval.repository.js';

export interface StorePostEval {
  event_id: string;
  submission_id: string;
  section_summary: string;
  financial_report: object;
}

@Injectable()
export class PostEvalService {
  constructor(
    private readonly postevals: PostEvalRepository,
    private readonly submissions: SubmissionRepository,
    private readonly organizations: OrganizationRepository,
    private readonly config: AppConfigService,
  ) {}

  async eligible(organizationId: string): Promise<Item[]> {
    const blocked = new Set<string>();
    for (const row of await this.postevals.listOrg(organizationId)) {
      if (
        str(row, 'status') === 'submitted' ||
        str(row, 'status') === 'approved'
      ) {
        const eventId = stripPrefix(row.PK, 'EVENT#');
        if (eventId) {
          blocked.add(eventId);
        }
      }
    }
    const seen = new Set<string>();
    const eligible: Item[] = [];
    for (const submission of await this.submissions.listOrgSubmissions(
      organizationId,
    )) {
      const status = str(submission, 'status');
      if (status !== 'approved' && status !== 'finished') {
        continue;
      }
      const eventId = stripPrefix(submission.PK, 'EVENT#');
      if (!eventId || seen.has(eventId) || blocked.has(eventId)) {
        continue;
      }
      const effective = effectiveDate(submission);
      if (!effective || !this.windowOpen(effective)) {
        continue;
      }
      seen.add(eventId);
      eligible.push({
        event_id: eventId,
        submission_id: stripPrefix(submission.SK, 'SUBMISSION#'),
        event_title: str(
          record(submission.activity_details) ?? {},
          'title_and_nature',
        ),
        date_of_event: effective,
        status,
      });
    }
    return eligible;
  }

  async list(organizationId: string): Promise<Item[]> {
    const rows = await this.postevals.listOrg(organizationId);
    const org = await this.organizations.get(organizationId);
    const name = org ? str(org, 'name') : null;
    return rows
      .map((row) => this.view(name ? { ...row, organization_name: name } : row))
      .sort((left, right) =>
        String(right.submitted_at).localeCompare(String(left.submitted_at)),
      );
  }

  async adminList(status?: string, organizationId?: string): Promise<Item[]> {
    const orgs = organizationId
      ? [await this.organizations.get(organizationId)].filter(
          (org): org is Item => Boolean(org),
        )
      : await this.organizations.list();
    const rows: Item[] = [];
    for (const org of orgs) {
      const id = stripPrefix(org.PK, 'ORGANIZATION#') ?? '';
      const name = str(org, 'name');
      for (const row of await this.postevals.listOrg(id)) {
        if (status && str(row, 'status') !== status) {
          continue;
        }
        rows.push(this.view(name ? { ...row, organization_name: name } : row));
      }
    }
    return rows;
  }

  async create(organizationId: string, body: StorePostEval): Promise<Item> {
    const submission = await this.submissions.getSubmission(
      body.event_id,
      body.submission_id,
    );
    if (!submission) {
      throw new NotFoundException('Not Found');
    }
    if (stripPrefix(submission.GSI1PK, 'ORGANIZATION#') !== organizationId) {
      throw new NotFoundException('Not Found');
    }
    const status = str(submission, 'status');
    if (status !== 'approved' && status !== 'finished') {
      abort(422, 'A post-evaluation can only be filed for an approved event.');
    }
    const date = str(
      record(submission.activity_details) ?? {},
      'date_of_event',
    );
    if (!date || !this.windowOpen(date)) {
      abort(422, 'The post-evaluation window is closed for this event.');
    }
    const existing = await this.postevals.listForEvent(
      body.event_id,
      'POSTEVAL#',
    );
    if (
      existing.some(
        (row) =>
          str(row, 'status') === 'submitted' ||
          str(row, 'status') === 'approved',
      )
    ) {
      abort(409, 'A post-evaluation has already been filed for this event.');
    }
    const org = await this.organizations.get(organizationId);
    const id = randomUUID();
    const submittedAt = nowIso();
    const item: Item = {
      PK: eventKey(body.event_id),
      SK: postEvalKey(id),
      entity_type: 'posteval',
      GSI1PK: organizationKey(organizationId),
      GSI1SK: postEvalKey(id),
      organization_id: organizationId,
      organization_name: org ? str(org, 'name') : null,
      event_id: body.event_id,
      submission_id: body.submission_id,
      status: 'submitted',
      submitted_at: submittedAt,
      event_title:
        str(record(submission.activity_details) ?? {}, 'title_and_nature') ??
        '',
      section_summary: body.section_summary,
      financial_report: body.financial_report,
      participation_snapshot: await this.participants(body.event_id),
    };
    await this.postevals.put(item);
    return this.view(item);
  }

  async show(
    organizationId: string,
    eventId: string,
    postEvalId: string,
  ): Promise<Item> {
    const item = await this.require(eventId, postEvalId);
    if (stripPrefix(item.GSI1PK, 'ORGANIZATION#') !== organizationId) {
      throw new NotFoundException('Not Found');
    }
    return {
      ...this.view(item),
      participation: await this.participants(eventId),
    };
  }

  async adminShow(eventId: string, postEvalId: string): Promise<Item> {
    return this.view(await this.require(eventId, postEvalId));
  }

  async approve(eventId: string, postEvalId: string): Promise<Item> {
    const item = await this.require(eventId, postEvalId);
    if (str(item, 'status') === 'denied') {
      abort(422, 'A denied post-evaluation cannot be approved.');
    }
    let current = item;
    if (str(item, 'status') !== 'approved') {
      const approvedAt = nowIso();
      current = await this.postevals.update(eventId, postEvalId, {
        status: 'approved',
        approved_at: approvedAt,
      });
      const submissionId = str(item, 'submission_id');
      if (submissionId) {
        const submission = await this.submissions.getSubmission(
          eventId,
          submissionId,
        );
        if (submission && str(submission, 'status') === 'approved') {
          await this.submissions.updateSubmission(eventId, submissionId, {
            status: 'finished',
            finished_at: approvedAt,
          });
        }
      }
    }
    return this.view(current);
  }

  async deny(eventId: string, postEvalId: string): Promise<Item> {
    const item = await this.require(eventId, postEvalId);
    if (str(item, 'status') === 'approved') {
      abort(422, 'An approved post-evaluation cannot be denied.');
    }
    if (str(item, 'status') === 'denied') {
      return this.view(item);
    }
    const updated = await this.postevals.update(eventId, postEvalId, {
      status: 'denied',
      denied_at: nowIso(),
    });
    return this.view(updated);
  }

  async participants(eventId: string): Promise<ParticipantAggregate> {
    const rows = await this.postevals.listForEvent(eventId, 'MEMBER#');
    const evaluations = await this.postevals.listForEvent(
      eventId,
      'EVALUATION#',
    );
    const combined = [...rows, ...evaluations];
    const ids = combined
      .filter((row) => String(row.SK).startsWith('MEMBER#'))
      .map((row) => stripPrefix(row.SK, 'MEMBER#') ?? '');
    return aggregateParticipants(combined, await this.postevals.profiles(ids));
  }

  async eventOwned(eventId: string, organizationId: string): Promise<void> {
    const event = await this.submissions.getEvent(eventId);
    if (
      !event ||
      stripPrefix(event.GSI1PK, 'ORGANIZATION#') !== organizationId
    ) {
      throw new NotFoundException('Not Found');
    }
  }

  private windowOpen(date: string): boolean {
    return eventWindow(
      date,
      'evaluation',
      this.config.postEvaluationWindowDays(),
    ).is_open;
  }

  private async require(eventId: string, postEvalId: string): Promise<Item> {
    const item = await this.postevals.get(eventId, postEvalId);
    if (!item) {
      throw new NotFoundException('Not Found');
    }
    return item;
  }

  private view(item: Item): Item {
    return {
      event_id: stripPrefix(item.PK, 'EVENT#'),
      posteval_id: stripPrefix(item.SK, 'POSTEVAL#'),
      submission_id: str(item, 'submission_id'),
      organization_id:
        stripPrefix(item.GSI1PK, 'ORGANIZATION#') ??
        str(item, 'organization_id'),
      organization_name: str(item, 'organization_name'),
      status: str(item, 'status'),
      event_title: str(item, 'event_title'),
      submitted_at: str(item, 'submitted_at'),
      approved_at: str(item, 'approved_at'),
      denied_at: str(item, 'denied_at'),
      section_summary: str(item, 'section_summary'),
      financial_report: item.financial_report ?? null,
      participation_snapshot: item.participation_snapshot ?? null,
    };
  }
}

function effectiveDate(submission: Item): string | null {
  const venue = record(submission.venue_reservation);
  if (venue?.has_reservation === true) {
    const dates: string[] = [];
    const reservations = Array.isArray(venue.reservations)
      ? venue.reservations
      : [];
    for (const reservation of reservations) {
      const selections = Array.isArray((reservation as Item).selections)
        ? ((reservation as Item).selections as Item[])
        : [];
      for (const selection of selections) {
        const date = str(selection, 'date');
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          dates.push(date);
        }
      }
    }
    dates.sort();
    if (dates[0]) {
      return dates[0];
    }
  }
  return str(record(submission.activity_details) ?? {}, 'date_of_event');
}
