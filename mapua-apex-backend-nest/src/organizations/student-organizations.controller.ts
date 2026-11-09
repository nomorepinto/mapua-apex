import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrganizationId, Roles } from '../common/decorators.js';
import { UpdateOrgRolesDto } from './dto/organization.dto.js';
import { CreateOfficerDto, UpdateOfficerDto } from './dto/officer.dto.js';
import {
  OfficerView,
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

  @Patch('organization/roles')
  patchRoles(
    @OrganizationId() organizationId: string,
    @Body() body: UpdateOrgRolesDto,
  ): Promise<OrganizationView> {
    return this.organizations.patchRoles(organizationId, body.position_roles);
  }

  // ── Officer roster ──────────────────────────────────────────────────────────

  @Get('organization/officers')
  listOfficers(
    @OrganizationId() organizationId: string,
  ): Promise<OfficerView[]> {
    return this.organizations.listOfficers(organizationId);
  }

  @Post('organization/officers')
  createOfficer(
    @OrganizationId() organizationId: string,
    @Body() body: CreateOfficerDto,
  ): Promise<OfficerView> {
    return this.organizations.createOfficer(organizationId, body);
  }

  @Patch('organization/officers/:officerId')
  updateOfficer(
    @OrganizationId() organizationId: string,
    @Param('officerId') officerId: string,
    @Body() body: UpdateOfficerDto,
  ): Promise<OfficerView> {
    return this.organizations.updateOfficer(organizationId, officerId, body);
  }

  @Delete('organization/officers/:officerId')
  async deleteOfficer(
    @OrganizationId() organizationId: string,
    @Param('officerId') officerId: string,
  ): Promise<{ data: null }> {
    await this.organizations.deleteOfficer(organizationId, officerId);
    return { data: null };
  }

  @Get('organizations')
  list(): Promise<OrganizationDirectoryEntry[]> {
    return this.organizations.directory();
  }
}
