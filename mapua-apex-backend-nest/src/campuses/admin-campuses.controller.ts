import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Roles } from '../common/decorators.js';
import { CampusService } from './campus.service.js';
import type { CampusView } from './campus.repository.js';
import { CampusDto } from './dto/campus.dto.js';

@Controller('admins/campuses')
@Roles('admin')
export class AdminCampusesController {
  constructor(private readonly campuses: CampusService) {}

  @Get()
  list(): Promise<CampusView[]> {
    return this.campuses.list();
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: CampusDto): Promise<CampusView> {
    return this.campuses.create(body);
  }

  @Put(':campus')
  update(
    @Param('campus') campus: string,
    @Body() body: CampusDto,
  ): Promise<CampusView> {
    return this.campuses.update(campus, body);
  }

  @Delete(':campus')
  @HttpCode(204)
  async remove(@Param('campus') campus: string): Promise<void> {
    await this.campuses.remove(campus);
  }
}
