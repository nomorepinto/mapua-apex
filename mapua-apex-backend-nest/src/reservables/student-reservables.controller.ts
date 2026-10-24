import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../common/decorators.js';
import type { ReservableView } from './reservable.repository.js';
import { ReservableService } from './reservable.service.js';

@Controller('students/campuses/:campus/reservables')
@Roles('student')
export class StudentReservablesController {
  constructor(private readonly reservables: ReservableService) {}

  @Get()
  list(@Param('campus') campus: string): Promise<ReservableView[]> {
    return this.reservables.list(campus);
  }
}
