import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/decorators.js';
import { AccountsService } from './accounts.service.js';
import type { AccountView } from './cognito-account.js';

@Controller('admins/accounts')
@Roles('admin')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(): Promise<AccountView[]> {
    return this.accounts.list();
  }
}
