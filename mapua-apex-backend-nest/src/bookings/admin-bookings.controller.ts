import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Roles, SignatoryId } from '../common/decorators.js';
import { BookingService, type BookingView } from './booking.service.js';
import { StoreBookingDto } from './dto/booking.dto.js';

@Controller('admins/campuses/:campus/reservables/:reservable')
@Roles('admin')
export class AdminBookingsController {
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

  @Get('bookings')
  list(
    @Param('campus') campus: string,
    @Param('reservable') reservable: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ): Promise<BookingView[]> {
    return this.bookings.listInWindow(campus, reservable, start, end);
  }

  @Post('bookings')
  @HttpCode(201)
  create(
    @Param('campus') campus: string,
    @Param('reservable') reservable: string,
    @Body() body: StoreBookingDto,
    @SignatoryId() signatoryId: string,
  ): Promise<BookingView> {
    return this.bookings.createManual(
      campus,
      reservable,
      body.selections,
      body.reason,
      signatoryId,
    );
  }

  @Delete('bookings/:booking')
  @HttpCode(204)
  async remove(
    @Param('reservable') reservable: string,
    @Param('booking') booking: string,
  ): Promise<void> {
    await this.bookings.deleteManual(reservable, booking);
  }
}
