import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../common/decorators.js';
import type { Item } from '../common/records.js';
import { SubmissionQueryService } from './submission-query.service.js';

@Controller('admins')
@Roles('admin')
export class AdminSubmissionsController {
  constructor(private readonly query: SubmissionQueryService) {}

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
}
