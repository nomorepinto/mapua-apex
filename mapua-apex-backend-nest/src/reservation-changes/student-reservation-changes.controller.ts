import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentCaller, OrganizationId, Roles } from '../common/decorators.js';
import type { Item } from '../common/records.js';
import { StoreReservationChangeDto } from './dto/reservation-change.dto.js';
import { ReservationChangeService } from './reservation-change.service.js';

@Controller('students')
@Roles('student')
export class StudentReservationChangesController {
  constructor(private readonly changes: ReservationChangeService) {}

  @Post('events/:event/submissions/:submission/reservation-change')
  @HttpCode(201)
  request(
    @OrganizationId() organizationId: string,
    @CurrentCaller() caller: { sub: string },
    @Param('event') event: string,
    @Param('submission') submission: string,
    @Body() body: StoreReservationChangeDto,
  ): Promise<Item> {
    return this.changes.request(
      organizationId,
      caller.sub,
      event,
      submission,
      body.request_type,
      body.reason,
      body.suggested_date,
    );
  }

  @Get('events/:event/submissions/:submission/reservation-changes')
  list(
    @OrganizationId() organizationId: string,
    @Param('event') event: string,
    @Param('submission') submission: string,
  ): Promise<Item[]> {
    return this.changes.listForStudent(organizationId, event, submission);
  }
}
