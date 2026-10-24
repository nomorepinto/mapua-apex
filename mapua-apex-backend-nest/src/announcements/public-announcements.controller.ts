import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators.js';
import {
  AnnouncementService,
  type AnnouncementView,
} from './announcement.service.js';

@Controller('public/announcements')
@Public()
export class PublicAnnouncementsController {
  constructor(private readonly announcements: AnnouncementService) {}

  @Get()
  list(): Promise<AnnouncementView[]> {
    return this.announcements.list();
  }
}
