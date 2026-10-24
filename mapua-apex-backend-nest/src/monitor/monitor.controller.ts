import { Controller, Get, Param, Query } from '@nestjs/common';
import { NoEnvelope, Roles } from '../common/decorators.js';
import type { Item } from '../common/records.js';
import { MonitorService, type MonitorPage } from './monitor.service.js';

@Controller('admins/monitor')
@Roles('admin')
export class MonitorController {
  constructor(private readonly monitor: MonitorService) {}

  @Get('sessions')
  @NoEnvelope()
  sessions(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ): Promise<MonitorPage> {
    return this.monitor.sessions({
      startDate,
      endDate,
      userId,
      role,
      status,
      limit,
    });
  }

  @Get('sessions/:id')
  session(@Param('id') id: string): Promise<Item> {
    return this.monitor.session(id);
  }

  @Get('activity')
  @NoEnvelope()
  activity(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Query('role') role?: string,
    @Query('actionType') actionType?: string,
    @Query('module') module?: string,
    @Query('limit') limit?: string,
  ): Promise<MonitorPage> {
    return this.monitor.activity({
      startDate,
      endDate,
      userId,
      role,
      actionType,
      module,
      limit,
    });
  }

  @Get('activity/:activityId')
  activityItem(@Param('activityId') activityId: string): Promise<Item> {
    return this.monitor.activityItem(activityId);
  }

  @Get('stats')
  stats(): Promise<Item> {
    return this.monitor.stats();
  }
}
