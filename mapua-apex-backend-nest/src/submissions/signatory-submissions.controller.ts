import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles, SignatoryId } from '../common/decorators.js';
import type { Item } from '../common/records.js';
import { ClassificationPatchDto, CommentDto } from './dto/saaf.dto.js';
import { toSubmission } from './submission.mapper.js';
import { SubmissionQueryService } from './submission-query.service.js';
import { SubmissionReviewService } from './submission-review.service.js';
import type { BookingConflict } from '../bookings/booking.service.js';
import { RoutingService } from './routing.service.js';

@Controller('signatories')
@Roles('signatory')
export class SignatorySubmissionsController {
  constructor(
    private readonly query: SubmissionQueryService,
    private readonly review: SubmissionReviewService,
    private readonly routing: RoutingService,
  ) {}

  @Get('submissions')
  queue(@SignatoryId() signatoryId: string): Promise<Item[]> {
    return this.query.signatoryQueue(signatoryId);
  }

  @Get('submissions/history')
  history(@SignatoryId() signatoryId: string): Promise<Item[]> {
    return this.query.history(signatoryId);
  }

  @Get('events/:event/submissions/:submission')
  show(
    @SignatoryId() signatoryId: string,
    @Param('event') event: string,
    @Param('submission') submission: string,
  ): Promise<Item> {
    return this.query.signatoryShow(signatoryId, event, submission);
  }

  @Get('events/:event/submissions/:submission/booking-conflicts')
  conflicts(
    @SignatoryId() signatoryId: string,
    @Param('event') event: string,
    @Param('submission') submission: string,
  ): Promise<BookingConflict[]> {
    return this.review.bookingConflicts(signatoryId, event, submission);
  }

  @Post('events/:event/submissions/:submission/approve')
  async approve(
    @SignatoryId() signatoryId: string,
    @Param('event') event: string,
    @Param('submission') submission: string,
  ): Promise<Item> {
    const item = await this.review.approve(signatoryId, event, submission);
    return toSubmission(item, {
      signatory_chain: await this.routing.chain(item),
    });
  }

  @Post('events/:event/submissions/:submission/return')
  async returnForRevision(
    @SignatoryId() signatoryId: string,
    @Param('event') event: string,
    @Param('submission') submission: string,
    @Body() body: CommentDto,
  ): Promise<Item> {
    const item = await this.review.returnForRevision(
      signatoryId,
      event,
      submission,
      body.comment,
    );
    return toSubmission(item);
  }

  @Post('events/:event/submissions/:submission/deny')
  async deny(
    @SignatoryId() signatoryId: string,
    @Param('event') event: string,
    @Param('submission') submission: string,
    @Body() body: CommentDto,
  ): Promise<Item> {
    const item = await this.review.deny(
      signatoryId,
      event,
      submission,
      body.comment,
    );
    return toSubmission(item);
  }

  @Patch('events/:event/submissions/:submission/classification')
  async classify(
    @SignatoryId() signatoryId: string,
    @Param('event') event: string,
    @Param('submission') submission: string,
    @Body() body: ClassificationPatchDto,
  ): Promise<Item> {
    const item = await this.review.classify(
      signatoryId,
      event,
      submission,
      body.nature,
    );
    return toSubmission(item);
  }
}
