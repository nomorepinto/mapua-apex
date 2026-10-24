import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class StoreReservationChangeDto {
  @IsIn(['cancel', 'reschedule'])
  request_type!: 'cancel' | 'reschedule';

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  suggested_date?: string;
}

class SelectionDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(11, { each: true })
  slots!: number[];
}

class BookingInstructionDto {
  @IsString()
  pk!: string;

  @IsString()
  sk!: string;

  @IsIn(['keep', 'update', 'swap'])
  action!: 'keep' | 'update' | 'swap';

  @ValidateIf((row: BookingInstructionDto) => row.action === 'swap')
  @IsString()
  new_reservable_id?: string;

  @ValidateIf((row: BookingInstructionDto) => row.action !== 'keep')
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectionDto)
  selections?: SelectionDto[];
}

export class ResolveReservationChangeDto {
  @IsIn(['cancel', 'reschedule', 'deny'])
  decision!: 'cancel' | 'reschedule' | 'deny';

  @ValidateIf((row: ResolveReservationChangeDto) => row.decision === 'deny')
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingInstructionDto)
  bookings?: BookingInstructionDto[];
}
