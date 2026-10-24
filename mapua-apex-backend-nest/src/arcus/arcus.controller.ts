import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ArcusOrganizationId,
  ArcusService as ArcusRoute,
  NoEnvelope,
} from '../common/decorators.js';
import type { Item } from '../common/records.js';
import { ArcusService } from './arcus.service.js';

@Controller('arcus')
@ArcusRoute()
export class ArcusController {
  constructor(private readonly arcus: ArcusService) {}

  @Get('events')
  events(
    @ArcusOrganizationId() organizationId: string | null,
    @Query('window') window?: string,
  ): Promise<Item[]> {
    return this.arcus.events(
      organizationId,
      window === 'evaluation' ? 'evaluation' : 'attendance',
    );
  }

  @Get('students/:studentId/events')
  studentEvents(
    @Param('studentId') studentId: string,
    @Query('window') window?: string,
  ): Promise<Item[]> {
    return this.arcus.studentEvents(
      studentId,
      window === 'evaluation' ? 'evaluation' : 'attendance',
    );
  }

  @Get('events/:eventId/post-eval')
  @NoEnvelope()
  postEval(
    @Param('eventId') eventId: string,
    @ArcusOrganizationId() organizationId: string | null,
  ): Promise<Item> {
    return this.arcus.postEval(eventId, organizationId);
  }
}
