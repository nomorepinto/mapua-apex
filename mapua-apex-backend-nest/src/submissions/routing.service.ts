import { Injectable } from '@nestjs/common';
import { abort } from '../common/http.js';
import { stripPrefix } from '../common/dynamo-keys.js';
import { str, type Item } from '../common/records.js';
import { desksOf } from '../organizations/organization.repository.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { SignatoryRepository } from '../signatories/signatory.repository.js';

@Injectable()
export class RoutingService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly signatories: SignatoryRepository,
  ) {}

  async sequenceFor(
    proponentOrgId: string,
    dependentOrgIds: string[],
    activityType: string,
    hasReservation: boolean,
  ): Promise<string[]> {
    const orgIds = unique([proponentOrgId, ...dependentOrgIds]);
    const orgs = new Map<string, Item>();
    for (const id of orgIds) {
      const org = await this.organizations.get(id);
      if (!org) {
        abort(422, 'The selected organization does not exist.');
      }
      orgs.set(id, org);
    }
    const ids: string[] = [];
    for (const id of orgIds) {
      ids.push(this.desk(orgs.get(id) as Item, 'adviser'));
    }
    if (activityType === 'co-curricular') {
      for (const id of orgIds) {
        const org = orgs.get(id) as Item;
        if (org.is_higher_council === true) {
          continue;
        }
        ids.push(this.desk(org, 'dean'));
      }
    }
    ids.push(await this.campus('osaar'));
    if (hasReservation) {
      ids.push(await this.campus('cdm'));
    }
    return unique(ids);
  }

  async chain(submission: Item): Promise<Item[]> {
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
        chain.push({ signatory_id: signatoryId, ...owned });
        continue;
      }
      const person = await this.signatories.get(signatoryId);
      chain.push({
        signatory_id: signatoryId,
        role: person ? str(person, 'role') : null,
        organization_id: null,
        organization_name: null,
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

function unique(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => id !== ''))];
}
