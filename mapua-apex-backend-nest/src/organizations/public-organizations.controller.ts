import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators.js';
import {
  OrganizationService,
  type OrganizationDirectoryEntry,
} from './organization.service.js';

@Controller('public/organizations')
@Public()
export class PublicOrganizationsController {
  constructor(private readonly organizations: OrganizationService) {}

  @Get()
  list(): Promise<OrganizationDirectoryEntry[]> {
    return this.organizations.directory();
  }
}
