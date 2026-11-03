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
import { Roles, SignatoryId } from '../common/decorators.js';
import type { Item } from '../common/records.js';
import { ResolveReservationChangeDto } from './dto/reservation-change.dto.js';
import { ReservationChangeService } from './reservation-change.service.js';

@Controller('admins')
@Roles('admin')
export class AdminReservationChangesController {
  constructor(private readonly changes: ReservationChangeService) {}

  @Get('campuses/:campus/reservation-changes')
  async list(
    @Param('campus') campus: string,
    @Query('status') status?: string,
    @Query('filters') filters?: string,
  ): Promise<Item[]> {
    return filterCollection(
      'reservation_changes',
      await this.changes.listForCampus(campus, status),
      filters,
    );
  }

  @Post('campuses/:campus/reservation-changes/report')
  @Roles('report_admin')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  report(
    @Param('campus') campus: string,
    @Body() body: unknown,
  ): Promise<Item> {
    return this.changes.report(campus, body);
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
