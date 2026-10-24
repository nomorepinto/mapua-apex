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
import { ReservableDto } from './dto/reservable.dto.js';
import type { ReservableView } from './reservable.repository.js';
import { ReservableService } from './reservable.service.js';

@Controller('admins/campuses/:campus/reservables')
@Roles('admin')
export class AdminReservablesController {
  constructor(private readonly reservables: ReservableService) {}

  @Get()
  list(@Param('campus') campus: string): Promise<ReservableView[]> {
    return this.reservables.list(campus);
  }

  @Post()
  @HttpCode(201)
  create(
    @Param('campus') campus: string,
    @Body() body: ReservableDto,
  ): Promise<ReservableView> {
    return this.reservables.create(campus, body);
  }

  @Put(':reservable')
  update(
    @Param('campus') campus: string,
    @Param('reservable') reservable: string,
    @Body() body: ReservableDto,
  ): Promise<ReservableView> {
    return this.reservables.update(campus, reservable, body);
  }

  @Delete(':reservable')
  @HttpCode(204)
  async remove(
    @Param('campus') campus: string,
    @Param('reservable') reservable: string,
  ): Promise<void> {
    await this.reservables.remove(campus, reservable);
  }
}
