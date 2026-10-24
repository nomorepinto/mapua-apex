import { Module } from '@nestjs/common';
import { ReservablesModule } from '../reservables/reservables.module.js';
import { AdminBookingsController } from './admin-bookings.controller.js';
import { BookingRepository } from './booking.repository.js';
import { BookingService } from './booking.service.js';
import { StudentAvailabilityController } from './student-availability.controller.js';

@Module({
  imports: [ReservablesModule],
  controllers: [AdminBookingsController, StudentAvailabilityController],
  providers: [BookingRepository, BookingService],
  exports: [BookingService],
})
export class BookingsModule {}
