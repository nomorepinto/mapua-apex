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
import { AssignAccountDto } from '../accounts/dto/assign-account.dto.js';
import type { AccountView } from '../accounts/cognito-account.js';
import { CurrentCaller, Roles } from '../common/decorators.js';
import type { AuthenticatedCaller } from '../common/caller.js';
import { SignatoryDto } from './dto/signatory.dto.js';
import { SignatoryService, type SignatoryView } from './signatory.service.js';
import type { SignatoryContact } from './signatory.repository.js';

/** Desk contact details from the request body, if any were supplied. */
function contactOf(body: SignatoryDto): SignatoryContact {
  return {
    email: body.contact_email ?? null,
    office: body.office ?? null,
    number: body.contact_number ?? null,
  };
}

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
    return this.signatories.create(
      body.name,
      body.role,
      body.department,
      body.campus_id,
      body.all_campuses,
      contactOf(body),
    );
  }

  @Put(':signatory/account')
  assignAccount(
    @Param('signatory') signatory: string,
    @Body() body: AssignAccountDto,
    @CurrentCaller() caller: AuthenticatedCaller,
  ): Promise<AccountView | null> {
    return this.signatories.assignAccount(signatory, body.username, caller.sub);
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
      body.campus_id,
      body.all_campuses,
      contactOf(body),
    );
  }

  @Delete(':signatory')
  @HttpCode(204)
  async remove(@Param('signatory') signatory: string): Promise<void> {
    await this.signatories.remove(signatory);
  }
}
