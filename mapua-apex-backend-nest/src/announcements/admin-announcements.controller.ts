import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Get } from '@nestjs/common';
import { Roles } from '../common/decorators.js';
import { AnnouncementDto } from './dto/announcement.dto.js';
import {
  AnnouncementService,
  type AnnouncementView,
} from './announcement.service.js';

@Controller('admins/announcements')
@Roles('admin')
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AnnouncementService) {}

  @Get()
  list(): Promise<AnnouncementView[]> {
    return this.announcements.list();
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: AnnouncementDto): Promise<AnnouncementView> {
    return this.announcements.create(body.content);
  }

  @Put(':announcement')
  update(
    @Param('announcement') announcement: string,
    @Body() body: AnnouncementDto,
  ): Promise<AnnouncementView> {
    return this.announcements.update(announcement, body.content);
  }

  @Delete(':announcement')
  @HttpCode(204)
  async remove(@Param('announcement') announcement: string): Promise<void> {
    await this.announcements.remove(announcement);
  }
}
