import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { Roles } from '../common/decorators.js';
import type { Item } from '../common/records.js';
import { SaafDto } from './dto/saaf.dto.js';
import { toSubmission } from './submission.mapper.js';
import { SubmissionQueryService } from './submission-query.service.js';
import { SubmissionWriterService } from './submission-writer.service.js';
import { RoutingService } from './routing.service.js';

@Controller('admins')
@Roles('admin')
export class AdminSubmissionsController {
  constructor(
    private readonly query: SubmissionQueryService,
    private readonly writer: SubmissionWriterService,
    private readonly routing: RoutingService,
  ) {}

  @Get('submissions')
  list(
    @Query('status') status?: string,
    @Query('activity_type') activityType?: string,
    @Query('organization_id') organizationId?: string,
  ): Promise<Item[]> {
    return this.query.adminList(status, activityType, organizationId);
  }

  @Get('events/:event/submissions/:submission')
  show(
    @Param('event') event: string,
    @Param('submission') submission: string,
  ): Promise<Item> {
    return this.query.adminShow(event, submission);
  }

  @Put('events/:event/submissions/:submission')
  async update(
    @Param('event') event: string,
    @Param('submission') submission: string,
    @Body() body: SaafDto,
  ): Promise<Item> {
    const item = await this.writer.adminUpdate(event, submission, body);
    return toSubmission(item, {
      signatory_chain: await this.routing.chain(item),
    });
  }
}
