import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Roles, SignatoryId } from '../common/decorators.js';
import type { Item } from '../common/records.js';
import { ResolveReservationChangeDto } from './dto/reservation-change.dto.js';
import { ReservationChangeService } from './reservation-change.service.js';

@Controller('admins')
@Roles('admin')
export class AdminReservationChangesController {
  constructor(private readonly changes: ReservationChangeService) {}

  @Get('campuses/:campus/reservation-changes')
  list(
    @Param('campus') campus: string,
    @Query('status') status?: string,
  ): Promise<Item[]> {
    return this.changes.listForCampus(campus, status);
  }

  @Get('campuses/:campus/reservation-changes/:change')
  show(
    @Param('campus') campus: string,
    @Param('change') change: string,
  ): Promise<Item> {
    return this.changes.showForCampus(campus, change);
  }

  @Post('campuses/:campus/reservation-changes/:change/resolve')
  resolve(
    @Param('campus') campus: string,
    @Param('change') change: string,
    @SignatoryId() signatoryId: string,
    @Body() body: ResolveReservationChangeDto,
  ): Promise<Item> {
    return this.changes.resolve(campus, change, signatoryId, body);
  }
}
