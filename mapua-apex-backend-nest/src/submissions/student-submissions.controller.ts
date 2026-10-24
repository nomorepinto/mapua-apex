import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { OrganizationId, Roles } from '../common/decorators.js';
import { MailService } from '../mail/mail.service.js';
import { CreateSaafDto, SaafDto } from './dto/saaf.dto.js';
import { toSubmission } from './submission.mapper.js';
import { SubmissionQueryService } from './submission-query.service.js';
import { SubmissionWriterService } from './submission-writer.service.js';
import { RoutingService } from './routing.service.js';
import type { Item } from '../common/records.js';

@Controller('students')
@Roles('student')
export class StudentSubmissionsController {
  constructor(
    private readonly writer: SubmissionWriterService,
    private readonly query: SubmissionQueryService,
    private readonly routing: RoutingService,
    private readonly mail: MailService,
  ) {}

  @Get('submissions')
  list(@OrganizationId() organizationId: string): Promise<Item[]> {
    return this.query.studentList(organizationId);
  }

  @Post('submissions')
  @HttpCode(201)
  async create(
    @OrganizationId() organizationId: string,
    @Body() body: CreateSaafDto,
  ): Promise<Item> {
    const item = await this.writer.create(organizationId, body);
    await this.mail.submitted(item);
    return toSubmission(item, {
      role: 'proponent',
      signatory_chain: await this.routing.chain(item),
    });
  }

  @Get('events/:event/submissions/:submission')
  show(
    @OrganizationId() organizationId: string,
    @Param('event') event: string,
    @Param('submission') submission: string,
  ): Promise<Item> {
    return this.query.studentShow(organizationId, event, submission);
  }

  @Put('events/:event/submissions/:submission')
  async update(
    @OrganizationId() organizationId: string,
    @Param('event') event: string,
    @Param('submission') submission: string,
    @Body() body: SaafDto,
  ): Promise<Item> {
    const result = await this.writer.update(
      organizationId,
      event,
      submission,
      body,
    );
    if (result.before.status === 'returned') {
      await this.mail.resubmitted(result.after);
    }
    return toSubmission(result.after, {
      role: 'proponent',
      signatory_chain: await this.routing.chain(result.after),
    });
  }

  @Get('events/:event/submissions/:submission/notifications')
  notifications(
    @OrganizationId() organizationId: string,
    @Param('event') event: string,
    @Param('submission') submission: string,
  ): Promise<Item[]> {
    return this.query.notifications(organizationId, event, submission);
  }
}
