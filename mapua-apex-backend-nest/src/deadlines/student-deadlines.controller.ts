import { Controller, Get } from '@nestjs/common';
import { OrganizationId, Roles } from '../common/decorators.js';
import type { Item } from '../common/records.js';
import { DeadlineService } from './deadline.service.js';

@Controller('students')
@Roles('student')
export class StudentDeadlinesController {
  constructor(private readonly deadlines: DeadlineService) {}

  @Get('deadlines')
  list(@OrganizationId() organizationId: string): Promise<Item[]> {
    return this.deadlines.list(organizationId);
  }
}
