import { Module } from '@nestjs/common';
import { SignatoriesModule } from '../signatories/signatories.module.js';
import { AdminApprovalSettingsController } from './admin-approval-settings.controller.js';
import { ApprovalSettingsRepository } from './approval-settings.repository.js';
import { ApprovalSettingsService } from './approval-settings.service.js';

@Module({
  imports: [SignatoriesModule],
  controllers: [AdminApprovalSettingsController],
  providers: [ApprovalSettingsRepository, ApprovalSettingsService],
  exports: [ApprovalSettingsService],
})
export class ApprovalSettingsModule {}
