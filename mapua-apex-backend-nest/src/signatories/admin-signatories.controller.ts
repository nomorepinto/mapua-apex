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
import { SignatoryDto } from './dto/signatory.dto.js';
import { SignatoryService, type SignatoryView } from './signatory.service.js';

@Controller('admins/signatories')
@Roles('admin')
export class AdminSignatoriesController {
  constructor(private readonly signatories: SignatoryService) {}

  @Get()
  list(): Promise<SignatoryView[]> {
    return this.signatories.list();
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: SignatoryDto): Promise<SignatoryView> {
    return this.signatories.create(body.name, body.role, body.department);
  }

  @Put(':signatory')
  update(
    @Param('signatory') signatory: string,
    @Body() body: SignatoryDto,
  ): Promise<SignatoryView> {
    return this.signatories.update(
      signatory,
      body.name,
      body.role,
      body.department,
    );
  }

  @Delete(':signatory')
  @HttpCode(204)
  async remove(@Param('signatory') signatory: string): Promise<void> {
    await this.signatories.remove(signatory);
  }
}
