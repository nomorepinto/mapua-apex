import { Controller, Get } from '@nestjs/common';
import { OrganizationId, Roles } from '../common/decorators.js';
import {
  OrganizationService,
  type OrganizationDirectoryEntry,
  type OrganizationView,
} from './organization.service.js';

@Controller('students')
@Roles('student')
export class StudentOrganizationsController {
  constructor(private readonly organizations: OrganizationService) {}

  @Get('organization')
  show(@OrganizationId() organizationId: string): Promise<OrganizationView> {
    return this.organizations.showForStudent(organizationId);
  }

  @Get('organizations')
  list(): Promise<OrganizationDirectoryEntry[]> {
    return this.organizations.directory();
  }
}
