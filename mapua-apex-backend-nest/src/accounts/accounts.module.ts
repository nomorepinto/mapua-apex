import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { CognitoAccountsRepository } from './cognito-accounts.repository.js';

@Module({
  controllers: [AccountsController],
  providers: [CognitoAccountsRepository, AccountsService],
  exports: [AccountsService, CognitoAccountsRepository],
})
export class AccountsModule {}
