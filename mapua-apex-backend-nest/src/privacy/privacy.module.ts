import { Module } from '@nestjs/common';
import { PublicPrivacyNoticeController } from './public-privacy-notice.controller.js';

/** Serves the versioned RA 10173 notice; the text lives in `privacy-notice.ts`. */
@Module({ controllers: [PublicPrivacyNoticeController] })
export class PrivacyModule {}
