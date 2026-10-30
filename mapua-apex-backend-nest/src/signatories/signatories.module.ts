import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module.js';
import { AdminSignatoriesController } from './admin-signatories.controller.js';
import { SignatoryProfileController } from './signatory-profile.controller.js';
import { SignatoryRepository } from './signatory.repository.js';
import { SignatoryService } from './signatory.service.js';

@Module({
  imports: [AccountsModule],
  controllers: [SignatoryProfileController, AdminSignatoriesController],
  providers: [SignatoryRepository, SignatoryService],
  exports: [SignatoryService, SignatoryRepository],
})
export class SignatoriesModule {}
