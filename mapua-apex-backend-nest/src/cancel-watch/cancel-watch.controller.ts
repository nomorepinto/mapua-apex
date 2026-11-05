import { Body, Controller, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { Roles } from '../common/decorators.js';
import { AppConfigService } from '../config/app-config.service.js';
import {
  CancelWatchService,
  type CancelWatchResult,
} from './cancel-watch.service.js';
import { ExpireCancelWatchDto } from './dto/expire-cancel-watch.dto.js';

/**
 * Local-only test trigger. The real trigger is a TTL-expiry `REMOVE` delivered
 * to the Streams consumer Lambda, which cannot fire against the hosted table in
 * a browser test. This route runs the identical `evaluateAndCancel` path on
 * demand so the Playwright suite can observe the auto-cancel. Gated to a
 * local-like `APP_ENV` (mirrors `VITE_ALLOW_ANY_EVENT_DATE`) and admin-only.
 */
@Controller('admins/cancel-watch')
@Roles('admin')
export class CancelWatchController {
  constructor(
    private readonly cancelWatch: CancelWatchService,
    private readonly config: AppConfigService,
  ) {}

  @Post('expire')
  @HttpCode(200)
  expire(@Body() body: ExpireCancelWatchDto): Promise<CancelWatchResult> {
    if (!this.config.isLocalLike()) {
      throw new NotFoundException('Not Found');
    }
    return this.cancelWatch.evaluateAndCancel(body.event_id, body.submission_id);
  }
}
