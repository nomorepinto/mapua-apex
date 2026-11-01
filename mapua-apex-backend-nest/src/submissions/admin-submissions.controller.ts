import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { filterCollection } from '../common/reporting.js';
import { Roles } from '../common/decorators.js';
import type { Item } from '../common/records.js';
import { SubmissionQueryService } from './submission-query.service.js';

@Controller('admins')
@Roles('admin')
export class AdminSubmissionsController {
  constructor(private readonly query: SubmissionQueryService) {}

  @Get('submissions')
  async list(
    @Query('status') status?: string,
    @Query('activity_type') activityType?: string,
    @Query('organization_id') organizationId?: string,
    @Query('filters') filters?: string,
  ): Promise<Item[]> {
    return filterCollection(
      'proposals',
      await this.query.adminList(status, activityType, organizationId),
      filters,
    );
  }

  @Post('submissions/report')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  report(@Body() body: unknown): Promise<Item> {
    return this.query.report(body, 'admin');
  }

  @Get('events/:event/submissions/:submission')
  show(
    @Param('event') event: string,
    @Param('submission') submission: string,
  ): Promise<Item> {
    return this.query.adminShow(event, submission);
  }
}
