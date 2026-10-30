import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module.js';
import { SignatoriesModule } from '../signatories/signatories.module.js';
import { AdminOrganizationsController } from './admin-organizations.controller.js';
import { OrganizationRepository } from './organization.repository.js';
import { OrganizationService } from './organization.service.js';
import { PublicOrganizationsController } from './public-organizations.controller.js';
import { StudentOrganizationsController } from './student-organizations.controller.js';

@Module({
  imports: [AccountsModule, SignatoriesModule],
  controllers: [
    PublicOrganizationsController,
    StudentOrganizationsController,
    AdminOrganizationsController,
  ],
  providers: [OrganizationRepository, OrganizationService],
  exports: [OrganizationService, OrganizationRepository],
})
export class OrganizationsModule {}
