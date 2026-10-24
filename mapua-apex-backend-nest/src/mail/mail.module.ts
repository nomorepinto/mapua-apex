import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SignatoriesModule } from '../signatories/signatories.module.js';
import { MailService } from './mail.service.js';

@Module({
  imports: [SignatoriesModule, OrganizationsModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
