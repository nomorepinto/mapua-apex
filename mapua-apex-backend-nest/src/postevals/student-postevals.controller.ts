import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { filterCollection } from '../common/reporting.js';
import { OrganizationId, Roles } from '../common/decorators.js';
import type { Item } from '../common/records.js';
import type { ParticipantAggregate } from './participants.js';
import { StorePostEvalDto } from './dto/posteval.dto.js';
import { PostEvalService } from './posteval.service.js';

@Controller('students')
@Roles('student')
export class StudentPostEvalsController {
  constructor(private readonly postevals: PostEvalService) {}

  @Get('postevals/events')
  events(@OrganizationId() organizationId: string): Promise<Item[]> {
    return this.postevals.eligible(organizationId);
  }

  @Get('postevals')
  async list(
    @OrganizationId() organizationId: string,
    @Query('filters') filters?: string,
  ): Promise<Item[]> {
    return filterCollection(
      'postevals',
      await this.postevals.list(organizationId),
      filters,
    );
  }

  @Post('postevals')
  @HttpCode(201)
  create(
    @OrganizationId() organizationId: string,
    @Body() body: StorePostEvalDto,
  ): Promise<Item> {
    return this.postevals.create(organizationId, body);
  }

  @Get('events/:event/postevals/:posteval')
  show(
    @OrganizationId() organizationId: string,
    @Param('event') event: string,
    @Param('posteval') posteval: string,
  ): Promise<Item> {
    return this.postevals.show(organizationId, event, posteval);
  }

  @Get('events/:event/participants')
  async participants(
    @OrganizationId() organizationId: string,
    @Param('event') event: string,
  ): Promise<ParticipantAggregate> {
    await this.postevals.eventOwned(event, organizationId);
    return this.postevals.participants(event);
  }
}
