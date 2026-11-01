import { Module } from '@nestjs/common';
import { MonitorController } from './monitor.controller.js';
import { MonitorService } from './monitor.service.js';
import { MonitorRepository } from './monitor.repository.js';

@Module({
  controllers: [MonitorController],
  providers: [MonitorService, MonitorRepository],
})
export class MonitorModule {}
