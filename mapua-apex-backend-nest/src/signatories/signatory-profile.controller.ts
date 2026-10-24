import { Controller, Get } from '@nestjs/common';
import { Roles, SignatoryId } from '../common/decorators.js';
import { SignatoryService, type SignatoryView } from './signatory.service.js';

@Controller('signatories')
@Roles('signatory')
export class SignatoryProfileController {
  constructor(private readonly signatories: SignatoryService) {}

  @Get('me')
  me(@SignatoryId() signatoryId: string): Promise<SignatoryView> {
    return this.signatories.me(signatoryId);
  }
}
