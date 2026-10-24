import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/decorators.js';
import {
  AnnouncementService,
  type AnnouncementView,
} from './announcement.service.js';

@Controller('students/announcements')
@Roles('student')
export class StudentAnnouncementsController {
  constructor(private readonly announcements: AnnouncementService) {}

  @Get()
  list(): Promise<AnnouncementView[]> {
    return this.announcements.list();
  }
}
