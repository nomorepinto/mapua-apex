import { Module } from '@nestjs/common';
import { ApprovalSettingsModule } from '../approval-settings/approval-settings.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { MailModule } from '../mail/mail.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SignatoriesModule } from '../signatories/signatories.module.js';
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
    BookingsModule,
    MailModule,
    ApprovalSettingsModule,
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
