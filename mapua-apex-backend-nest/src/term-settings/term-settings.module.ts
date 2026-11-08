import { Module } from '@nestjs/common';
import { TermSettingsController } from './term-settings.controller.js';
import { PublicTermController } from './public-term.controller.js';
import { TermSettingsRepository } from './term-settings.repository.js';
import { TermSettingsService } from './term-settings.service.js';
import { ActivityModule } from '../activity/activity.module.js';

@Module({ imports: [ActivityModule], controllers: [TermSettingsController, PublicTermController], providers: [TermSettingsRepository, TermSettingsService], exports: [TermSettingsService] })
export class TermSettingsModule {}
