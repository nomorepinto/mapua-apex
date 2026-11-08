import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { CampusesModule } from '../campuses/campuses.module.js';
import { MailModule } from '../mail/mail.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SignatoriesModule } from '../signatories/signatories.module.js';
import { TermSettingsModule } from '../term-settings/term-settings.module.js';
import { AdminSubmissionsController } from './admin-submissions.controller.js';
import { RoutingService } from './routing.service.js';
import { SignatorySubmissionsController } from './signatory-submissions.controller.js';
import { StudentSubmissionsController } from './student-submissions.controller.js';
import { SubmissionQueryService } from './submission-query.service.js';
import { SubmissionRepository } from './submission.repository.js';
import { SubmissionReviewService } from './submission-review.service.js';
import { SubmissionWriterService } from './submission-writer.service.js';

@Module({
  imports: [
    OrganizationsModule,
    SignatoriesModule,
    CampusesModule,
    BookingsModule,
    MailModule,
    TermSettingsModule,
  ],
  controllers: [
    StudentSubmissionsController,
    SignatorySubmissionsController,
    AdminSubmissionsController,
  ],
  providers: [
    SubmissionRepository,
    RoutingService,
    SubmissionWriterService,
    SubmissionReviewService,
    SubmissionQueryService,
  ],
  exports: [SubmissionRepository, RoutingService, SubmissionQueryService],
})
export class SubmissionsModule {}
