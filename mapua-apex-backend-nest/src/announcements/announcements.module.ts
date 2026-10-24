import { Module } from '@nestjs/common';
import { AdminAnnouncementsController } from './admin-announcements.controller.js';
import { AnnouncementRepository } from './announcement.repository.js';
import { AnnouncementService } from './announcement.service.js';
import { PublicAnnouncementsController } from './public-announcements.controller.js';
import { StudentAnnouncementsController } from './student-announcements.controller.js';

@Module({
  controllers: [
    PublicAnnouncementsController,
    StudentAnnouncementsController,
    AdminAnnouncementsController,
  ],
  providers: [AnnouncementRepository, AnnouncementService],
  exports: [AnnouncementService],
})
export class AnnouncementsModule {}
