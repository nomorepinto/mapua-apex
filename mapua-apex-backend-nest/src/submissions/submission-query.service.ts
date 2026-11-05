import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { generateReport } from '../common/reporting.js';
import { stripPrefix } from '../common/dynamo-keys.js';
import { str, type Item } from '../common/records.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { SignatoryRepository } from '../signatories/signatory.repository.js';
import { desksOf } from '../organizations/organization.repository.js';
import { dependentIds, RoutingService } from './routing.service.js';
import {
  approvalChainContacts,
  type ApprovalChainContact,
} from './approval-contacts.js';
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

  report(
    input: unknown,
    scope: 'admin' | 'student' | 'history',
    id = '',
  ): Promise<Item> {
    return generateReport(
      'proposals',
      input,
      scope === 'admin'
        ? 'All administratively visible proposals'
        : `${scope}: ${id}`,
      () =>
        scope === 'admin'
          ? this.iterateAdmin()
          : scope === 'student'
            ? this.iterateStudent(id)
            : this.iterateHistory(id),
    );
  }

  async studentList(organizationId: string): Promise<Item[]> {
    const rows: Item[] = [];
    for await (const row of this.iterateStudent(organizationId)) rows.push(row);
    return rows.sort((left, right) =>
      String(right.sent_at).localeCompare(String(left.sent_at)),
    );
  }

  private async *iterateStudent(organizationId: string): AsyncGenerator<Item> {
    const seen = new Set<string>();
    for await (const item of this.submissions.iterateOrgSubmissions(
      organizationId,
    )) {
      seen.add(`${item.PK}|${item.SK}`);
      yield toSubmission(item, { role: 'proponent' });
    }
    const collab = await this.submissions.listCollaborations(organizationId);
    const keys = collab.map((pointer) => ({
      eventId: str(pointer, 'event_id') ?? '',
      submissionId: str(pointer, 'submission_id') ?? '',
    }));
    if (keys.some((key) => !key.eventId || !key.submissionId))
      throw new ServiceUnavailableException({
        code: 'RETRIEVAL_INCOMPLETE',
        message:
          'Collaboration references are incomplete. Retry after records are repaired.',
      });
    for (let offset = 0; offset < keys.length; offset += 100) {
      const batch = keys.slice(offset, offset + 100);
      const masters = await this.submissions.batchSubmissions(batch);
      if (
        masters.length !==
        new Set(batch.map((key) => `${key.eventId}|${key.submissionId}`)).size
      )
        throw new ServiceUnavailableException({
          code: 'RETRIEVAL_INCOMPLETE',
          message:
            'A linked proposal could not be retrieved. Retry after records are repaired.',
        });
      for (const master of masters) {
        if (
          seen.has(`${master.PK}|${master.SK}`) ||
          !dependentIds(master).includes(organizationId)
        )
          continue;
        seen.add(`${master.PK}|${master.SK}`);
        yield toSubmission(master, { role: 'dependent' });
      }
    }
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
    const chain = await this.routing.chain(item);
    return toSubmission(item, {
      role,
      signatory_chain: chain,
      approval_chain_contacts: await this.approvalContacts(item, chain),
    });
  }

  /**
   * Desk contact details for the proponent's own proposal. Only this read
   * produces them: the fields belong to the desk rather than the paper, so the
   * list, reviewer, and admin surfaces must not serialize them.
   */
  private async approvalContacts(
    item: Item,
    chain: Item[],
  ): Promise<ApprovalChainContact[]> {
    const ids = chain.flatMap((link) => {
      const id = str(link, 'signatory_id');
      return id ? [id] : [];
    });
    return approvalChainContacts({
      chain,
      people: await this.signatories.listByIds(ids),
      status: str(item, 'status'),
      currentSignatoryId: str(item, 'current_signatory'),
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
    const rows: Item[] = [];
    for await (const row of this.iterateHistory(signatoryId)) rows.push(row);
    return rows;
  }

  private async *iterateHistory(signatoryId: string): AsyncGenerator<Item> {
    const person = await this.signatories.get(signatoryId);
    const role = person ? (str(person, 'role') ?? '') : '';
    const department = person
      ? (str(person, 'department') ?? '').toLowerCase()
      : '';
    const bare = stripPrefix(signatoryId, 'SIGNATORY#') ?? signatoryId;
    const organizations = await this.organizations.list();
    for (const org of organizations) {
      const orgId = stripPrefix(org.PK, 'ORGANIZATION#') ?? '';
      const adviser = desksOf(org).some(
        (desk) => desk.role === 'adviser' && desk.signatory_id === bare,
      );
      for await (const item of this.submissions.iterateOrgSubmissions(orgId)) {
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
          yield toSubmission(item, { organization_name: str(org, 'name') });
        }
      }
    }
  }

  async adminList(
    status?: string,
    activityType?: string,
    organizationId?: string,
  ): Promise<Item[]> {
    const rows: Item[] = [];
    for await (const row of this.iterateAdmin(
      status,
      activityType,
      organizationId,
    ))
      rows.push(row);
    return rows;
  }

  private async *iterateAdmin(
    status?: string,
    activityType?: string,
    organizationId?: string,
  ): AsyncGenerator<Item> {
    const orgs = organizationId
      ? [await this.organizations.get(organizationId)].filter(
          (org): org is Item => Boolean(org),
        )
      : await this.organizations.list();
    for (const org of orgs) {
      const orgId = stripPrefix(org.PK, 'ORGANIZATION#') ?? '';
      for await (const item of this.submissions.iterateOrgSubmissions(orgId)) {
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
        yield toSubmission(item, { organization_name: str(org, 'name') });
      }
    }
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
