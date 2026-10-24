import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators.js';
import type { Item } from '../common/records.js';
import { PostEvalService } from './posteval.service.js';

@Controller('admins')
@Roles('admin')
export class AdminPostEvalsController {
  constructor(private readonly postevals: PostEvalService) {}

  @Get('postevals')
  list(
    @Query('status') status?: string,
    @Query('organization_id') organizationId?: string,
  ): Promise<Item[]> {
    return this.postevals.adminList(status, organizationId);
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
