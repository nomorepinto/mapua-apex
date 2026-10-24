import { Controller, Get } from '@nestjs/common';
import { NoEnvelope, Public } from '../common/decorators.js';

@Controller()
@Public()
@NoEnvelope()
export class HealthController {
  @Get('ping')
  ping(): { ok: true } {
    return { ok: true };
  }

  /** Root health check, outside the `/api/v2` prefix. */
  @Get('up')
  up(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
