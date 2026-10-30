import { Injectable } from '@nestjs/common';
import { abort } from '../common/http.js';
import { signatoryKey, stripPrefix } from '../common/dynamo-keys.js';
import { list, str, type Item } from '../common/records.js';
import { SignatoryRepository } from '../signatories/signatory.repository.js';
import {
  ApprovalSettingsRepository,
  type StoredOsaarStage,
} from './approval-settings.repository.js';

export interface OsaarStageView {
  key: string;
  order: number;
  signatory_id: string;
  signatory_name: string;
}

export interface ApprovalSettingsView {
  osaar_stages: OsaarStageView[];
}

const MAX_STAGES = 10;

@Injectable()
export class ApprovalSettingsService {
  constructor(
    private readonly settings: ApprovalSettingsRepository,
    private readonly signatories: SignatoryRepository,
  ) {}

  async view(): Promise<ApprovalSettingsView> {
    const stored = await this.settings.get();
    if (stored) {
      return { osaar_stages: await this.viewsFor(readStages(stored)) };
    }
    const ids = await this.signatories.listIdsByRole('osaar');
    if (ids.length !== 1 || !ids[0]) {
      return { osaar_stages: [] };
    }
    return {
      osaar_stages: await this.viewsFor([
        { key: 'osaar_1', signatory_id: signatoryKey(ids[0]) },
      ]),
    };
  }

  async replace(rawIds: string[]): Promise<ApprovalSettingsView> {
    const ids = rawIds.map((id) => stripPrefix(id, 'SIGNATORY#') ?? id);
    if (ids.length === 0) {
      abort(422, 'At least one OSAAR stage is required.');
    }
    if (ids.length > MAX_STAGES) {
      abort(422, `OSAAR approval stages cannot exceed ${MAX_STAGES}.`);
    }
    if (ids.some((id) => id === '')) {
      abort(422, 'Each OSAAR stage must be an existing OSAAR signatory.');
    }
    if (new Set(ids).size !== ids.length) {
      abort(422, 'Each OSAAR stage must be a different signatory.');
    }
    for (const id of ids) {
      const person = await this.signatories.get(id);
      if (!person || str(person, 'role') !== 'osaar') {
        abort(422, 'Each OSAAR stage must be an existing OSAAR signatory.');
      }
    }
    const stages = ids.map((id, index) => ({
      key: `osaar_${index + 1}`,
      signatory_id: signatoryKey(id),
    }));
    await this.settings.save(stages);
    return { osaar_stages: await this.viewsFor(stages) };
  }

  /**
   * OSAAR signatory ids for a new submission, in stage order.
   * A missing settings item falls back to the single OSAAR signatory.
   */
  async osaarStageIds(): Promise<string[]> {
    const stored = await this.settings.get();
    if (stored) {
      const stages = readStages(stored);
      if (stages.length === 0) {
        abort(422, 'No osaar signatory is configured.');
      }
      const ids: string[] = [];
      for (const stage of stages) {
        const id = stripPrefix(stage.signatory_id, 'SIGNATORY#');
        const person = id ? await this.signatories.get(id) : undefined;
        if (!id || !person || str(person, 'role') !== 'osaar') {
          abort(
            422,
            'An OSAAR approval stage points at a signatory that is no longer an OSAAR account.',
          );
        }
        ids.push(id);
      }
      return ids;
    }
    const ids = await this.signatories.listIdsByRole('osaar');
    if (ids.length === 1 && ids[0]) {
      return [ids[0]];
    }
    if (ids.length === 0) {
      abort(422, 'No osaar signatory is configured.');
    }
    abort(
      422,
      'More than one OSAAR signatory exists. Configure OSAAR approval stages before sending a proposal.',
    );
  }

  private async viewsFor(
    stages: StoredOsaarStage[],
  ): Promise<OsaarStageView[]> {
    const views: OsaarStageView[] = [];
    for (const [index, stage] of stages.entries()) {
      const id = stripPrefix(stage.signatory_id, 'SIGNATORY#') ?? '';
      const person = id ? await this.signatories.get(id) : undefined;
      views.push({
        key: stage.key,
        order: index + 1,
        signatory_id: id,
        signatory_name: person ? (str(person, 'name') ?? '') : '',
      });
    }
    return views;
  }
}

function readStages(item: Item): StoredOsaarStage[] {
  return list(item, 'osaar_stages').flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return [];
    }
    const row = entry as Item;
    const key = str(row, 'key');
    const signatoryId = str(row, 'signatory_id');
    if (!key || !signatoryId) {
      return [];
    }
    return [{ key, signatory_id: signatoryId }];
  });
}
