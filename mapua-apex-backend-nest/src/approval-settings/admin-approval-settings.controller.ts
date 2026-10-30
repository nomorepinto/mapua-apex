import { Body, Controller, Get, Put } from '@nestjs/common';
import { Roles } from '../common/decorators.js';
import {
  ApprovalSettingsService,
  type ApprovalSettingsView,
} from './approval-settings.service.js';
import { UpdateApprovalSettingsDto } from './dto/approval-settings.dto.js';

@Controller('admins/approval-settings')
@Roles('admin')
export class AdminApprovalSettingsController {
  constructor(private readonly settings: ApprovalSettingsService) {}

  @Get()
  show(): Promise<ApprovalSettingsView> {
    return this.settings.view();
  }

  @Put()
  update(
    @Body() body: UpdateApprovalSettingsDto,
  ): Promise<ApprovalSettingsView> {
    return this.settings.replace(body.osaar_stage_signatory_ids);
  }
}
