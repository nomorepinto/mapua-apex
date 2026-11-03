import { Injectable } from '@nestjs/common';
import { CampusRepository } from '../campuses/campus.repository.js';
import { abort } from '../common/http.js';
import { stripPrefix } from '../common/dynamo-keys.js';
import { bool, num, str, type Item } from '../common/records.js';
import { SignatoryRepository } from '../signatories/signatory.repository.js';

export interface OsaarStageView {
  key: string;
  order: number;
  signatory_id: string;
  signatory_name: string;
  campus_id: string;
  campus_name: string;
}

export interface ApprovalCampusGroup {
  campus_id: string;
  campus_name: string;
  osaar_stages: OsaarStageView[];
}

export interface NamedSignatory {
  signatory_id: string;
  signatory_name: string;
}

export interface ApprovalSettingsView {
  campuses: ApprovalCampusGroup[];
  all_campus_signatory: NamedSignatory | null;
  unassigned: NamedSignatory[];
}

@Injectable()
export class ApprovalSettingsService {
  constructor(
    private readonly signatories: SignatoryRepository,
    private readonly campuses: CampusRepository,
  ) {}

  async view(): Promise<ApprovalSettingsView> {
    const [campusItems, people] = await Promise.all([
      this.campuses.list(),
      this.signatories.listByRole('osaar'),
    ]);
    const osaar = people.filter((person) => str(person, 'role') === 'osaar');
    const campuses: ApprovalCampusGroup[] = campusItems.map((campus) => {
      const campusId = stripPrefix(campus.PK, 'CAMPUS#') ?? '';
      const campusName = str(campus, 'name') ?? '';
      const stages = osaar
        .filter(
          (person) =>
            !bool(person, 'all_campuses') &&
            str(person, 'campus_id') === campusId,
        )
        .sort(byOrder);
      return {
        campus_id: campusId,
        campus_name: campusName,
        osaar_stages: stages.map((person, index) => ({
          key: `osaar_${index + 1}`,
          order: index + 1,
          signatory_id: stripPrefix(person.PK, 'SIGNATORY#') ?? '',
          signatory_name: str(person, 'name') ?? '',
          campus_id: campusId,
          campus_name: campusName,
        })),
      };
    });
    const all = osaar.find((person) => bool(person, 'all_campuses'));
    const unassigned = osaar
      .filter(
        (person) => !bool(person, 'all_campuses') && !str(person, 'campus_id'),
      )
      .map((person) => ({
        signatory_id: stripPrefix(person.PK, 'SIGNATORY#') ?? '',
        signatory_name: str(person, 'name') ?? '',
      }));
    return {
      campuses,
      all_campus_signatory: all
        ? {
            signatory_id: stripPrefix(all.PK, 'SIGNATORY#') ?? '',
            signatory_name: str(all, 'name') ?? '',
          }
        : null,
      unassigned,
    };
  }

  /**
   * Rewrites the saved order of OSAAR accounts that already belong to this
   * campus. The list must be exactly those accounts.
   */
  async replace(
    campusId: string,
    rawIds: string[],
  ): Promise<ApprovalSettingsView> {
    const bare = stripPrefix(campusId, 'CAMPUS#') ?? campusId;
    const campus = await this.campuses.get(bare);
    if (!campus) {
      abort(422, 'The selected campus does not exist.');
    }
    const ids = rawIds.map((id) => stripPrefix(id, 'SIGNATORY#') ?? id);
    if (ids.some((id) => id === '')) {
      abort(422, 'Each OSAAR stage must be an existing OSAAR signatory.');
    }
    if (new Set(ids).size !== ids.length) {
      abort(422, 'Each OSAAR stage must be a different signatory.');
    }
    const assigned = (await this.signatories.listByRole('osaar')).filter(
      (person) =>
        str(person, 'role') === 'osaar' &&
        !bool(person, 'all_campuses') &&
        str(person, 'campus_id') === bare,
    );
    const assignedIds = new Set(
      assigned.flatMap((person) => {
        const id = stripPrefix(person.PK, 'SIGNATORY#');
        return id ? [id] : [];
      }),
    );
    if (
      ids.length !== assignedIds.size ||
      ids.some((id) => !assignedIds.has(id))
    ) {
      abort(
        422,
        'OSAAR approval stages must list each OSAAR assigned to this campus.',
      );
    }
    for (const [index, id] of ids.entries()) {
      await this.signatories.setOsaarOrder(id, index + 1);
    }
    return this.view();
  }
}

function byOrder(left: Item, right: Item): number {
  const order =
    (num(left, 'osaar_order') ?? 0) - (num(right, 'osaar_order') ?? 0);
  if (order !== 0) {
    return order;
  }
  return (str(left, 'PK') ?? '').localeCompare(str(right, 'PK') ?? '');
}
