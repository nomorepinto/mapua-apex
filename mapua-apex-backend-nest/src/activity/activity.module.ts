import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ActivityLogInterceptor } from './activity-log.interceptor.js';
import { ActivityLogService } from './activity-log.service.js';

@Module({
  providers: [
    ActivityLogService,
    { provide: APP_INTERCEPTOR, useClass: ActivityLogInterceptor },
  ],
  exports: [ActivityLogService],
})
export class ActivityModule {}
