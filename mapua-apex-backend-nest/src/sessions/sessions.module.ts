import { Module } from '@nestjs/common';
import { SESSION_READER } from '../auth/session-reader.js';
import { SessionService } from './session.service.js';
import { SessionsController } from './sessions.controller.js';

@Module({
  controllers: [SessionsController],
  providers: [
    SessionService,
    { provide: SESSION_READER, useExisting: SessionService },
  ],
  exports: [SessionService, SESSION_READER],
})
export class SessionsModule {}
