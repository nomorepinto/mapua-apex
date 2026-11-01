import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { SignatoriesModule } from '../signatories/signatories.module.js';
import { MailService } from './mail.service.js';

@Module({
  imports: [AccountsModule, SignatoriesModule, OrganizationsModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
