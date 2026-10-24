import { Injectable, NotFoundException } from '@nestjs/common';
import { stripPrefix } from '../common/dynamo-keys.js';
import { str, type Item } from '../common/records.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { SignatoryRepository } from '../signatories/signatory.repository.js';
import { desksOf } from '../organizations/organization.repository.js';
import { dependentIds, RoutingService } from './routing.service.js';
import { toNotification, toSubmission } from './submission.mapper.js';
import { SubmissionRepository } from './submission.repository.js';

@Injectable()
export class SubmissionQueryService {
  constructor(
    private readonly submissions: SubmissionRepository,
    private readonly organizations: OrganizationRepository,
    private readonly signatories: SignatoryRepository,
    private readonly routing: RoutingService,
  ) {}

  async studentList(organizationId: string): Promise<Item[]> {
    const own = await this.submissions.listOrgSubmissions(organizationId);
    const collab = await this.submissions.listCollaborations(organizationId);
    const seen = new Set(own.map((item) => `${item.PK}|${item.SK}`));
    const merged: Item[] = own.map((item) =>
      toSubmission(item, { role: 'proponent' }),
    );
    for (const pointer of collab) {
      const eventId = str(pointer, 'event_id');
      const submissionId = str(pointer, 'submission_id');
      if (!eventId || !submissionId) {
        continue;
      }
      const master = await this.submissions.getSubmission(
        eventId,
        submissionId,
      );
      if (!master || seen.has(`${master.PK}|${master.SK}`)) {
        continue;
      }
      seen.add(`${master.PK}|${master.SK}`);
      merged.push(toSubmission(master, { role: 'dependent' }));
    }
    return merged.sort((left, right) =>
      String(right.sent_at).localeCompare(String(left.sent_at)),
    );
  }

  async studentShow(
    organizationId: string,
    eventId: string,
    submissionId: string,
  ): Promise<Item> {
    const item = await this.require(eventId, submissionId);
    const proponent = stripPrefix(item.GSI1PK, 'ORGANIZATION#');
    const role = proponent === organizationId ? 'proponent' : 'dependent';
    if (role === 'dependent' && !dependentIds(item).includes(organizationId)) {
      throw new NotFoundException('Not Found');
    }
    if (role === 'proponent' && proponent !== organizationId) {
      throw new NotFoundException('Not Found');
    }
    return toSubmission(item, {
      role,
      signatory_chain: await this.routing.chain(item),
    });
  }

  async signatoryQueue(signatoryId: string): Promise<Item[]> {
    const items = await this.submissions.listQueue(signatoryId);
    return items.map((item) => toSubmission(item));
  }

  async signatoryShow(
    signatoryId: string,
    eventId: string,
    submissionId: string,
  ): Promise<Item> {
    const item = await this.requireVisible(signatoryId, eventId, submissionId);
    return toSubmission(item, {
      signatory_chain: await this.routing.chain(item),
    });
  }

  async history(signatoryId: string): Promise<Item[]> {
    const person = await this.signatories.get(signatoryId);
    const role = person ? (str(person, 'role') ?? '') : '';
    const department = person
      ? (str(person, 'department') ?? '').toLowerCase()
      : '';
    const bare = stripPrefix(signatoryId, 'SIGNATORY#') ?? signatoryId;
    const organizations = await this.organizations.list();
    const rows: Item[] = [];
    for (const org of organizations) {
      const orgId = stripPrefix(org.PK, 'ORGANIZATION#') ?? '';
      const adviser = desksOf(org).some(
        (desk) => desk.role === 'adviser' && desk.signatory_id === bare,
      );
      const submissions = await this.submissions.listOrgSubmissions(orgId);
      for (const item of submissions) {
        const status = str(item, 'status');
        const onDesk =
          (status === 'pending' || status === 'returned') &&
          stripPrefix(item.current_signatory, 'SIGNATORY#') === bare;
        if (onDesk) {
          continue;
        }
        const inSequence = (
          Array.isArray(item.signatory_sequence) ? item.signatory_sequence : []
        ).some((id) => stripPrefix(id, 'SIGNATORY#') === bare);
        const campus = role === 'osaar' || role === 'cdm' || role === 'admin';
        const deanMatch =
          role === 'dean' &&
          department !== '' &&
          JSON.stringify(item).toLowerCase().includes(department);
        if (
          campus ||
          (role === 'adviser' && (adviser || inSequence)) ||
          deanMatch ||
          inSequence
        ) {
          rows.push(
            toSubmission(item, { organization_name: str(org, 'name') }),
          );
        }
      }
    }
    return rows;
  }

  async adminList(
    status?: string,
    activityType?: string,
    organizationId?: string,
  ): Promise<Item[]> {
    const orgs = organizationId
      ? [await this.organizations.get(organizationId)].filter(
          (org): org is Item => Boolean(org),
        )
      : await this.organizations.list();
    const rows: Item[] = [];
    for (const org of orgs) {
      const orgId = stripPrefix(org.PK, 'ORGANIZATION#') ?? '';
      const submissions = await this.submissions.listOrgSubmissions(orgId);
      for (const item of submissions) {
        if (status && str(item, 'status') !== status) {
          continue;
        }
        const type = str(
          (item.activity_classification ?? {}) as Item,
          'activity_type',
        );
        if (activityType && type !== activityType) {
          continue;
        }
        rows.push(toSubmission(item, { organization_name: str(org, 'name') }));
      }
    }
    return rows;
  }

  async adminShow(eventId: string, submissionId: string): Promise<Item> {
    const item = await this.require(eventId, submissionId);
    const notes = await this.submissions.listNotifications(submissionId);
    return toSubmission(item, {
      signatory_chain: await this.routing.chain(item),
      notifications: notes.map((note) => toNotification(note)),
    });
  }

  async notifications(
    organizationId: string,
    eventId: string,
    submissionId: string,
  ): Promise<Item[]> {
    await this.studentShow(organizationId, eventId, submissionId);
    const notes = await this.submissions.listNotifications(submissionId);
    return notes.map((note) => toNotification(note));
  }

  private async require(eventId: string, submissionId: string): Promise<Item> {
    const item = await this.submissions.getSubmission(eventId, submissionId);
    if (!item) {
      throw new NotFoundException('Not Found');
    }
    return item;
  }

  private async requireVisible(
    signatoryId: string,
    eventId: string,
    submissionId: string,
  ): Promise<Item> {
    const item = await this.require(eventId, submissionId);
    const bare = stripPrefix(signatoryId, 'SIGNATORY#') ?? signatoryId;
    const onDesk = stripPrefix(item.current_signatory, 'SIGNATORY#') === bare;
    const inSequence = (
      Array.isArray(item.signatory_sequence) ? item.signatory_sequence : []
    ).some((id) => stripPrefix(id, 'SIGNATORY#') === bare);
    if (!onDesk && !inSequence) {
      throw new NotFoundException('Not Found');
    }
    return item;
  }
}
