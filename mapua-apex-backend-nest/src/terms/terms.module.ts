import { Module } from '@nestjs/common';
import { PublicTermsNoticeController } from './public-terms-notice.controller.js';

/** Serves the versioned SAAF T&C notice; the text lives in `terms-notice.ts`. */
@Module({ controllers: [PublicTermsNoticeController] })
export class TermsModule {}