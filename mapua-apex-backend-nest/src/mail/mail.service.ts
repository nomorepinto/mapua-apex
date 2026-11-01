import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SIGNATORY_ATTRIBUTE } from '../accounts/account-groups.js';
import { CognitoAccountsRepository } from '../accounts/cognito-accounts.repository.js';
import { SES_CLIENT } from '../aws/dynamo.port.js';
import { AppConfigService } from '../config/app-config.service.js';
import { stripPrefix } from '../common/dynamo-keys.js';
import { str, type Item } from '../common/records.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { SignatoryRepository } from '../signatories/signatory.repository.js';

/**
 * Best-effort SES mail. A missing address or SES error is logged and skipped
 * so the API response still succeeds. Sends are awaited before the handler
 * returns, because Lambda freezes the environment after the response.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(SES_CLIENT) private readonly ses: SESClient,
    private readonly accounts: CognitoAccountsRepository,
    private readonly config: AppConfigService,
    private readonly signatories: SignatoryRepository,
    private readonly organizations: OrganizationRepository,
  ) {}

  async submitted(submission: Item): Promise<void> {
    await this.guard('submitted', async () => {
      const desk = stripPrefix(submission.current_signatory, 'SIGNATORY#');
      if (desk) {
        await this.send(
          await this.signatoryEmail(desk),
          'New event submission',
          await this.deskBody(submission),
        );
      }
    });
  }

  async resubmitted(submission: Item): Promise<void> {
    await this.guard('resubmitted', async () => {
      const desk = stripPrefix(submission.current_signatory, 'SIGNATORY#');
      if (desk) {
        await this.send(
          await this.signatoryEmail(desk),
          'Submission resubmitted for your review',
          await this.deskBody(submission),
        );
      }
    });
  }

  async decision(
    submission: Item,
    kind: string,
    comment: string,
    nextSignatoryId?: string | null,
  ): Promise<void> {
    await this.guard(kind, async () => {
      const student = this.studentEmail(submission);
      const title = this.title(submission);
      if (kind === 'approved' && nextSignatoryId) {
        await this.send(
          student,
          `${title} was approved`,
          'Your submission was approved and moved to the next desk.',
        );
        await this.send(
          await this.signatoryEmail(nextSignatoryId),
          'New event submission',
          await this.deskBody(submission),
        );
      } else if (kind === 'fully approved') {
        await this.send(
          student,
          `${title} was fully approved`,
          'Your submission was fully approved.',
        );
      } else if (
        kind === 'event scheduled' ||
        kind === 'event scheduled no posteval'
      ) {
        const links = [
          this.config.arcusAttendanceUrl(),
          kind === 'event scheduled' ? this.config.arcusEvaluationUrl() : '',
        ]
          .filter(Boolean)
          .join('\n');
        await this.send(
          student,
          kind === 'event scheduled'
            ? 'Your event is approved — attendance & post-evaluation'
            : 'Your event is approved — attendance',
          `${comment}\n${links}`.trim(),
        );
      } else if (kind === 'denied' || kind === 'returned') {
        await this.send(
          student,
          kind === 'denied'
            ? 'Your submission was denied'
            : 'Your submission was returned for revision',
          comment,
        );
      } else if (
        kind === 'reservation cancelled' ||
        kind === 'reservation rescheduled' ||
        kind === 'reservation change denied'
      ) {
        await this.send(student, kind, comment);
      }
    });
  }

  private studentEmail(submission: Item): string | null {
    const proponents = submission.proponents;
    if (!Array.isArray(proponents) || proponents.length === 0) {
      return null;
    }
    return str(proponents[0] as Item, 'email_address');
  }

  private title(submission: Item): string {
    const details = submission.activity_details;
    if (typeof details === 'object' && details !== null) {
      return str(details as Item, 'title_and_nature') ?? 'your submission';
    }
    return 'your submission';
  }

  private async deskBody(submission: Item): Promise<string> {
    const orgId = stripPrefix(submission.GSI1PK, 'ORGANIZATION#');
    const org = orgId ? await this.organizations.get(orgId) : undefined;
    const name = org
      ? (str(org, 'name') ?? 'an organization')
      : 'an organization';
    return `New event submission from ${name}: ${this.title(submission)}`;
  }

  private async signatoryEmail(signatoryId: string): Promise<string | null> {
    const poolId = this.config.userPoolId();
    if (poolId === '') {
      return null;
    }
    try {
      const holders = await this.accounts.listByAttribute(
        SIGNATORY_ATTRIBUTE,
        signatoryId,
      );
      return holders[0]?.email ?? null;
    } catch (error) {
      this.logger.warn(
        `Signatory email lookup failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    }
  }

  private async send(
    to: string | null,
    subject: string,
    body: string,
  ): Promise<void> {
    const source = this.config.mailFromAddress();
    if (!to || source === '' || source === 'hello@example.com') {
      return;
    }
    try {
      await this.ses.send(
        new SendEmailCommand({
          Source: source,
          Destination: { ToAddresses: [to] },
          Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Text: { Data: body, Charset: 'UTF-8' } },
          },
        }),
      );
    } catch (error) {
      this.logger.warn(
        `SES send skipped: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  private async guard(
    method: string,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.warn(
        `Submission email dispatch failed (${method}): ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
