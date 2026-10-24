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
import { NoEnvelope, OrganizationId, Roles } from '../common/decorators.js';
import {
  BulkMembersDto,
  MemberDto,
  UpdateMemberDto,
} from './dto/member.dto.js';
import { MemberRepository, type MemberView } from './member.repository.js';

@Controller('students/members')
@Roles('student')
export class StudentMembersController {
  constructor(private readonly members: MemberRepository) {}

  @Get()
  list(@OrganizationId() organizationId: string): Promise<MemberView[]> {
    return this.members.list(organizationId);
  }

  @Post()
  @HttpCode(201)
  create(
    @OrganizationId() organizationId: string,
    @Body() body: MemberDto,
  ): Promise<MemberView> {
    return this.members.create(organizationId, body);
  }

  @Post('bulk')
  @HttpCode(201)
  @NoEnvelope()
  bulk(
    @OrganizationId() organizationId: string,
    @Body() body: BulkMembersDto,
  ): Promise<{
    created: MemberView[];
    failed: { student_number: string; error: string }[];
  }> {
    return this.members.bulk(organizationId, body.members);
  }

  @Put(':studentId')
  update(
    @OrganizationId() organizationId: string,
    @Param('studentId') studentId: string,
    @Body() body: UpdateMemberDto,
  ): Promise<MemberView> {
    return this.members.update(
      organizationId,
      studentId,
      body.lastname,
      body.firstname,
    );
  }

  @Delete(':studentId')
  @HttpCode(204)
  async remove(
    @OrganizationId() organizationId: string,
    @Param('studentId') studentId: string,
  ): Promise<void> {
    await this.members.remove(organizationId, studentId);
  }
}
