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
import { PostEvalService } from './posteval.service.js';

@Controller('admins')
@Roles('admin')
export class AdminPostEvalsController {
  constructor(private readonly postevals: PostEvalService) {}

  @Get('postevals')
  async list(
    @Query('status') status?: string,
    @Query('organization_id') organizationId?: string,
    @Query('filters') filters?: string,
  ): Promise<Item[]> {
    return filterCollection(
      'postevals',
      await this.postevals.adminList(status, organizationId),
      filters,
    );
  }

  @Post('postevals/report')
  @Roles('report_admin')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  report(@Body() body: unknown): Promise<Item> {
    return this.postevals.report(body);
  }

  @Get('postevals/:event/:posteval')
  show(
    @Param('event') event: string,
    @Param('posteval') posteval: string,
  ): Promise<Item> {
    return this.postevals.adminShow(event, posteval);
  }

  @Post('postevals/:event/:posteval/approve')
  @HttpCode(200)
  approve(
    @Param('event') event: string,
    @Param('posteval') posteval: string,
  ): Promise<Item> {
    return this.postevals.approve(event, posteval);
  }

  @Post('postevals/:event/:posteval/deny')
  @HttpCode(200)
  deny(
    @Param('event') event: string,
    @Param('posteval') posteval: string,
  ): Promise<Item> {
    return this.postevals.deny(event, posteval);
  }
}
