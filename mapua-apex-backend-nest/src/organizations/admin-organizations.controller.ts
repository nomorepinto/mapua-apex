import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Roles } from '../common/decorators.js';
import {
  OrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto.js';
import {
  OrganizationService,
  type OrganizationView,
} from './organization.service.js';

@Controller('admins/organizations')
@Roles('admin')
export class AdminOrganizationsController {
  constructor(private readonly organizations: OrganizationService) {}

  @Get()
  list(): Promise<OrganizationView[]> {
    return this.organizations.list();
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: OrganizationDto): Promise<OrganizationView> {
    return this.organizations.create(
      body.name,
      body.is_higher_council,
      body.signatories,
    );
  }

  @Put(':organization')
  update(
    @Param('organization') organization: string,
    @Body() body: UpdateOrganizationDto,
  ): Promise<OrganizationView> {
    return this.organizations.update(
      organization,
      body.name,
      body.is_higher_council,
      body.signatories,
    );
  }

  @Delete(':organization')
  @HttpCode(204)
  async remove(@Param('organization') organization: string): Promise<void> {
    await this.organizations.remove(organization);
  }
}
