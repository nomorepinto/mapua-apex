import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SubmissionsModule } from '../submissions/submissions.module.js';
import { AdminPostEvalsController } from './admin-postevals.controller.js';
import { PostEvalRepository } from './posteval.repository.js';
import { PostEvalService } from './posteval.service.js';
import { StudentPostEvalsController } from './student-postevals.controller.js';

@Module({
  imports: [SubmissionsModule, OrganizationsModule],
  controllers: [StudentPostEvalsController, AdminPostEvalsController],
  providers: [PostEvalRepository, PostEvalService],
  exports: [PostEvalService, PostEvalRepository],
})
export class PostEvalsModule {}
