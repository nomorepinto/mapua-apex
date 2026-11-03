import { Module } from '@nestjs/common';
import { CampusesModule } from '../campuses/campuses.module.js';
import { SignatoriesModule } from '../signatories/signatories.module.js';
import { AdminApprovalSettingsController } from './admin-approval-settings.controller.js';
import { ApprovalSettingsService } from './approval-settings.service.js';

@Module({
  imports: [SignatoriesModule, CampusesModule],
  controllers: [AdminApprovalSettingsController],
  providers: [ApprovalSettingsService],
  exports: [ApprovalSettingsService],
})
export class ApprovalSettingsModule {}
