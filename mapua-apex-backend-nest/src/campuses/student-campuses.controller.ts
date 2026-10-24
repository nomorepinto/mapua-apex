import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/decorators.js';
import type { CampusView } from './campus.repository.js';
import { CampusService } from './campus.service.js';

@Controller('students/campuses')
@Roles('student')
export class StudentCampusesController {
  constructor(private readonly campuses: CampusService) {}

  @Get()
  list(): Promise<CampusView[]> {
    return this.campuses.list();
  }
}
