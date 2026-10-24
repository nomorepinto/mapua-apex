import { Module } from '@nestjs/common';
import { MemberRepository } from './member.repository.js';
import { StudentMembersController } from './student-members.controller.js';

@Module({
  controllers: [StudentMembersController],
  providers: [MemberRepository],
  exports: [MemberRepository],
})
export class MembersModule {}
