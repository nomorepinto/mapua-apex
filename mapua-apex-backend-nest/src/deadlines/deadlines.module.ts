import { Module } from '@nestjs/common';
import { SubmissionsModule } from '../submissions/submissions.module.js';
import { DeadlineService } from './deadline.service.js';
import { StudentDeadlinesController } from './student-deadlines.controller.js';

@Module({
  imports: [SubmissionsModule],
  controllers: [StudentDeadlinesController],
  providers: [DeadlineService],
})
export class DeadlinesModule {}
