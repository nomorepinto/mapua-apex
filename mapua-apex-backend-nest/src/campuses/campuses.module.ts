import { Module } from '@nestjs/common';
import { AdminCampusesController } from './admin-campuses.controller.js';
import { CampusRepository } from './campus.repository.js';
import { CampusService } from './campus.service.js';
import { StudentCampusesController } from './student-campuses.controller.js';

@Module({
  controllers: [AdminCampusesController, StudentCampusesController],
  providers: [CampusRepository, CampusService],
  exports: [CampusService, CampusRepository],
})
export class CampusesModule {}
