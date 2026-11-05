import { IsString, MinLength } from 'class-validator';

/** Body for the local-only auto-cancel test trigger. */
export class ExpireCancelWatchDto {
  @IsString()
  @MinLength(1)
  event_id!: string;

  @IsString()
  @MinLength(1)
  submission_id!: string;
}
