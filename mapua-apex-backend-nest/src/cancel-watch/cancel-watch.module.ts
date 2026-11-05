import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { PostEvalsModule } from '../postevals/postevals.module.js';
import { SubmissionsModule } from '../submissions/submissions.module.js';
import { CancelWatchController } from './cancel-watch.controller.js';
import { CancelWatchService } from './cancel-watch.service.js';

@Module({
  imports: [SubmissionsModule, PostEvalsModule, MailModule],
  controllers: [CancelWatchController],
  providers: [CancelWatchService],
  exports: [CancelWatchService],
})
export class CancelWatchModule {}
