import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentCaller, NoEnvelope, Roles } from '../common/decorators.js';
import type { AuthenticatedCaller } from '../common/caller.js';
import type { Item } from '../common/records.js';
import { MonitorService, type MonitorPage } from './monitor.service.js';

@Controller('admins/monitor')
@Roles('admin')
export class MonitorController {
  constructor(private readonly monitor: MonitorService) {}

  @Get('sessions')
  @Roles('session_admin')
  @NoEnvelope()
  sessions(
    @Query() query: Record<string, string | undefined>,
    @CurrentCaller() caller: AuthenticatedCaller,
  ): Promise<MonitorPage> {
    return this.monitor.sessions(query, caller.sub);
  }

  @Post('sessions/report')
  @Roles('session_admin')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  sessionsReport(@Body() body: unknown): Promise<Item> {
    return this.monitor.report('sessions', body, 'Administrative session logs');
  }

  @Post('activity/report')
  @Roles('report_admin')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  activityReport(@Body() body: unknown): Promise<Item> {
    return this.monitor.report(
      'activity',
      body,
      'Administrative activity logs',
    );
  }

  @Get('sessions/:id')
  @Roles('session_admin')
  session(@Param('id') id: string): Promise<Item> {
    return this.monitor.session(id);
  }

  @Get('activity')
  @NoEnvelope()
  activity(
    @Query() query: Record<string, string | undefined>,
    @CurrentCaller() caller: AuthenticatedCaller,
  ): Promise<MonitorPage> {
    return this.monitor.activity(query, caller.sub);
  }

  @Get('activity/:activityId')
  activityItem(@Param('activityId') activityId: string): Promise<Item> {
    return this.monitor.activityItem(activityId);
  }

  @Get('stats')
  @Roles('session_admin')
  stats(): Promise<Item> {
    return this.monitor.stats();
  }
}
