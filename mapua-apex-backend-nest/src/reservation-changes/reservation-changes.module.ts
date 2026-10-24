import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { MailModule } from '../mail/mail.module.js';
import { ReservablesModule } from '../reservables/reservables.module.js';
import { SubmissionsModule } from '../submissions/submissions.module.js';
import { AdminReservationChangesController } from './admin-reservation-changes.controller.js';
import { ReservationChangeService } from './reservation-change.service.js';
import { StudentReservationChangesController } from './student-reservation-changes.controller.js';

@Module({
  imports: [SubmissionsModule, BookingsModule, ReservablesModule, MailModule],
  controllers: [
    StudentReservationChangesController,
    AdminReservationChangesController,
  ],
  providers: [ReservationChangeService],
})
export class ReservationChangesModule {}
