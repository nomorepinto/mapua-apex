import { Injectable } from '@nestjs/common';
import { ApprovalSettingsService } from '../approval-settings/approval-settings.service.js';
import { abort } from '../common/http.js';
import { stripPrefix } from '../common/dynamo-keys.js';
import { record, str, type Item } from '../common/records.js';
import { desksOf } from '../organizations/organization.repository.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { SignatoryRepository } from '../signatories/signatory.repository.js';

export interface SignatoryStep {
  key: string;
  role: string;
  signatory_id: string;
  organization_id: string | null;
}

@Injectable()
export class RoutingService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly signatories: SignatoryRepository,
    private readonly approvalSettings: ApprovalSettingsService,
  ) {}

  async sequenceFor(
    proponentOrgId: string,
    dependentOrgIds: string[],
    activityType: string,
    hasReservation: boolean,
    osaarStageIds?: string[],
  ): Promise<SignatoryStep[]> {
    const orgIds = unique([proponentOrgId, ...dependentOrgIds]);
    const orgs = new Map<string, Item>();
    for (const id of orgIds) {
      const org = await this.organizations.get(id);
      if (!org) {
        abort(422, 'The selected organization does not exist.');
      }
      orgs.set(id, org);
    }
    const steps: SignatoryStep[] = [];
    for (const id of orgIds) {
      steps.push({
        key: `adviser:ORG#${id}`,
        role: 'adviser',
        signatory_id: this.desk(orgs.get(id) as Item, 'adviser'),
        organization_id: id,
      });
    }
    if (activityType === 'co-curricular') {
      for (const id of orgIds) {
        const org = orgs.get(id) as Item;
        if (org.is_higher_council === true) {
          continue;
        }
        steps.push({
          key: `dean:ORG#${id}`,
          role: 'dean',
          signatory_id: this.desk(org, 'dean'),
          organization_id: id,
        });
      }
    }
    const osaarIds =
      osaarStageIds ?? (await this.approvalSettings.osaarStageIds());
    if (osaarIds.length === 0) {
      abort(422, 'No osaar signatory is configured.');
    }
    for (const id of osaarIds) {
      steps.push({
        key: 'osaar',
        role: 'osaar',
        signatory_id: id,
        organization_id: null,
      });
    }
    if (hasReservation) {
      steps.push({
        key: 'cdm',
        role: 'cdm',
        signatory_id: await this.campus('cdm'),
        organization_id: null,
      });
    }
    return dedupeSteps(steps);
  }

  /**
   * OSAAR signatory ids already frozen on this submission, in stage order.
   * Stored steps win. A legacy item uses sequence entries whose role is osaar.
   */
  async frozenOsaarStageIds(submission: Item): Promise<string[]> {
    const stored = readStoredSteps(submission);
    if (stored) {
      return stored
        .filter((step) => step.role === 'osaar')
        .map((step) => step.signatory_id);
    }
    const sequence = Array.isArray(submission.signatory_sequence)
      ? submission.signatory_sequence.map(
          (id) => stripPrefix(id, 'SIGNATORY#') ?? String(id),
        )
      : [];
    const ids: string[] = [];
    for (const id of sequence) {
      if (id === '') {
        continue;
      }
      const person = await this.signatories.get(id);
      if (person && str(person, 'role') === 'osaar') {
        ids.push(id);
      }
    }
    return ids;
  }

  async chain(submission: Item): Promise<Item[]> {
    const stored = readStoredSteps(submission);
    if (stored) {
      return this.chainFromSteps(stored);
    }
    const sequence = Array.isArray(submission.signatory_sequence)
      ? submission.signatory_sequence.map(
          (id) => stripPrefix(id, 'SIGNATORY#') ?? String(id),
        )
      : [];
    const proponent = stripPrefix(submission.GSI1PK, 'ORGANIZATION#');
    const dependents = dependentIds(submission);
    const orgIds = unique(
      [proponent, ...dependents].filter((id): id is string => Boolean(id)),
    );
    const deskOwner = new Map<
      string,
      { organization_id: string; organization_name: string; role: string }
    >();
    for (const orgId of orgIds) {
      const org = await this.organizations.get(orgId);
      if (!org) {
        continue;
      }
      for (const desk of desksOf(org)) {
        if (!deskOwner.has(desk.signatory_id)) {
          deskOwner.set(desk.signatory_id, {
            organization_id: orgId,
            organization_name: str(org, 'name') ?? '',
            role: desk.role,
          });
        }
      }
    }
    const chain: Item[] = [];
    for (const signatoryId of sequence) {
      const owned = deskOwner.get(signatoryId);
      if (owned) {
        chain.push({
          signatory_id: signatoryId,
          ...owned,
          stage_key: null,
        });
        continue;
      }
      const person = await this.signatories.get(signatoryId);
      chain.push({
        signatory_id: signatoryId,
        role: person ? str(person, 'role') : null,
        organization_id: null,
        organization_name: null,
        stage_key: null,
      });
    }
    return chain;
  }

  private async chainFromSteps(steps: SignatoryStep[]): Promise<Item[]> {
    const names = new Map<string, string | null>();
    const chain: Item[] = [];
    for (const step of steps) {
      let organizationName: string | null = null;
      if (step.organization_id) {
        if (!names.has(step.organization_id)) {
          const org = await this.organizations.get(step.organization_id);
          names.set(
            step.organization_id,
            org ? (str(org, 'name') ?? '') : null,
          );
        }
        organizationName = names.get(step.organization_id) ?? null;
      }
      chain.push({
        signatory_id: step.signatory_id,
        role: step.role,
        organization_id: step.organization_id,
        organization_name: organizationName,
        stage_key: step.key,
      });
    }
    return chain;
  }

  private desk(org: Item, role: string): string {
    const match = desksOf(org).find((desk) => desk.role === role);
    if (!match) {
      const name = str(org, 'name');
      abort(
        422,
        name
          ? `No ${role} signatory is assigned for ${name}.`
          : `No ${role} signatory is assigned.`,
      );
    }
    return match.signatory_id;
  }

  private async campus(role: string): Promise<string> {
    const id = await this.signatories.findIdByRole(role);
    if (!id) {
      abort(422, `No ${role} signatory is configured.`);
    }
    return id;
  }
}

export function dependentIds(submission: Item): string[] {
  const collaboration = submission.collaboration;
  if (typeof collaboration !== 'object' || collaboration === null) {
    return [];
  }
  const ids = (collaboration as Item).dependent_organization_ids;
  if (!Array.isArray(ids)) {
    return [];
  }
  return ids
    .map((id) =>
      typeof id === 'string' ? stripPrefix(id, 'ORGANIZATION#') : null,
    )
    .filter((id): id is string => Boolean(id));
}

function readStoredSteps(submission: Item): SignatoryStep[] | null {
  if (!Array.isArray(submission.signatory_steps)) {
    return null;
  }
  return submission.signatory_steps.flatMap((entry) => {
    const step = record(entry);
    if (!step) {
      return [];
    }
    const key = str(step, 'key');
    const signatoryId = stripPrefix(step.signatory_id, 'SIGNATORY#');
    if (!key || !signatoryId) {
      return [];
    }
    const organizationId = step.organization_id;
    return [
      {
        key,
        role: str(step, 'role') ?? '',
        signatory_id: signatoryId,
        organization_id:
          typeof organizationId === 'string'
            ? stripPrefix(organizationId, 'ORGANIZATION#')
            : null,
      },
    ];
  });
}

function dedupeSteps(steps: SignatoryStep[]): SignatoryStep[] {
  const seen = new Set<string>();
  const kept: SignatoryStep[] = [];
  for (const step of steps) {
    if (step.signatory_id === '' || seen.has(step.signatory_id)) {
      continue;
    }
    seen.add(step.signatory_id);
    kept.push(step);
  }
  let osaar = 0;
  return kept.map((step) => {
    if (step.role !== 'osaar') {
      return step;
    }
    osaar += 1;
    return { ...step, key: `osaar_${osaar}` };
  });
}

function unique(ids: (string | null | undefined)[]): string[] {
  return [
    ...new Set(ids.filter((id): id is string => Boolean(id) && id !== '')),
  ];
}
