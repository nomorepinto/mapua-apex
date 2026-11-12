import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators.js';
import { PRIVACY_NOTICE, type PrivacyNotice } from './privacy-notice.js';

/**
 * Read-only RA 10173 notice for the pre-submit consent gate. Public so the
 * frontend can render the current text and version before the proponent is
 * authenticated into a submission flow; there is no write side.
 */
@Controller('public/privacy-notice')
@Public()
export class PublicPrivacyNoticeController {
  @Get()
  get(): PrivacyNotice {
    return PRIVACY_NOTICE;
  }
}
