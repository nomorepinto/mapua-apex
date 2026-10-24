import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../common/decorators.js';
import { BookingService } from './booking.service.js';

@Controller('students/campuses/:campus/reservables/:reservable')
@Roles('student')
export class StudentAvailabilityController {
  constructor(private readonly bookings: BookingService) {}

  @Get('availability')
  availability(
    @Param('campus') campus: string,
    @Param('reservable') reservable: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ): Promise<Record<string, unknown>> {
    return this.bookings.availability(campus, reservable, start, end);
  }
}
