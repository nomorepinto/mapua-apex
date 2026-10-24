import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { PostEvalsModule } from '../postevals/postevals.module.js';
import { SubmissionsModule } from '../submissions/submissions.module.js';
import { ArcusController } from './arcus.controller.js';
import { ArcusService } from './arcus.service.js';

@Module({
  imports: [SubmissionsModule, OrganizationsModule, PostEvalsModule],
  controllers: [ArcusController],
  providers: [ArcusService],
})
export class ArcusModule {}
