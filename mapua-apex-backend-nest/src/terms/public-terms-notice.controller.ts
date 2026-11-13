import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators.js';
import { TERMS_NOTICE, type TermsNotice } from './terms-notice.js';

/**
 * Read-only SAAF Terms & Conditions notice for the pre-submit consent gate
 * (S-1). Public so the frontend can render the current text and version before
 * the proponent is authenticated into a submission flow; there is no write side.
 */
@Controller('public/terms-notice')
@Public()
export class PublicTermsNoticeController {
  @Get()
  get(): TermsNotice {
    return TERMS_NOTICE;
  }
}