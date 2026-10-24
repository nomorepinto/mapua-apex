import { Module } from '@nestjs/common';
import { InputCheckService } from './input-check.service.js';
import { InputChecksController } from './input-checks.controller.js';

@Module({
  controllers: [InputChecksController],
  providers: [InputCheckService],
})
export class InputChecksModule {}
