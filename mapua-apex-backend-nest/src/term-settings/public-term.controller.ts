import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators.js';
import { TermSettingsService } from './term-settings.service.js';
import type { TermSettings } from './term-window.js';

/** Read-only schedule guidance for date pickers; write access remains OSAAR-only. */
@Controller('public/term')
@Public()
export class PublicTermController {
  constructor(private readonly terms: TermSettingsService) {}

  @Get()
  get(): Promise<TermSettings | undefined> { return this.terms.get(); }
}
