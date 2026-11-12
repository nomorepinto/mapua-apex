import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentCaller, Roles } from '../common/decorators.js';
import type { AuthenticatedCaller } from '../common/caller.js';
import { ActivityLogService } from '../activity/activity-log.service.js';
import { UpdateTermSettingsDto } from './dto/term-settings.dto.js';
import { TermSettingsService } from './term-settings.service.js';
import type { TermSettings } from './term-window.js';

@Controller('osaar/term')
@Roles('osaar')
export class TermSettingsController {
  constructor(
    private readonly terms: TermSettingsService,
    private readonly activity: ActivityLogService,
  ) {}

  @Get()
  get(): Promise<TermSettings | undefined> { return this.terms.get(); }

  @Put()
  async update(@Body() body: UpdateTermSettingsDto, @CurrentCaller() caller: AuthenticatedCaller): Promise<TermSettings> {
    const before = await this.terms.get();
    const after = await this.terms.replace(body, caller.sub);
    const activeLabel = after.academic_years.find(
      (year) => year.id === after.active_academic_year_id,
    )?.label ?? 'academic calendar';
    await this.activity.write({
      sessionId: caller.sub, userId: caller.sub, userName: caller.name || caller.email,
      userEmail: caller.email, userRole: 'osaar', ipAddress: '',
      actionType: 'TERM_SETTINGS_UPDATE', module: 'TermSettings', entityId: 'OSAAR#TERM',
      entityName: activeLabel, organizationName: 'N/A',
      description: `Updated academic calendar settings for ${activeLabel}.`, before, after,
    });
    return after;
  }
}
