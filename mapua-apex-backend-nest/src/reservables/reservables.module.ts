import { Module } from '@nestjs/common';
import { CampusesModule } from '../campuses/campuses.module.js';
import { AdminReservablesController } from './admin-reservables.controller.js';
import { ReservableRepository } from './reservable.repository.js';
import { ReservableService } from './reservable.service.js';
import { StudentReservablesController } from './student-reservables.controller.js';

@Module({
  imports: [CampusesModule],
  controllers: [AdminReservablesController, StudentReservablesController],
  providers: [ReservableRepository, ReservableService],
  exports: [ReservableRepository, ReservableService],
})
export class ReservablesModule {}
