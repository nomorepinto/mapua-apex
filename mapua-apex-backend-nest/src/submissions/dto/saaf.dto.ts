import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const NO_DIGITS = { message: 'Names cannot contain numbers.' };

export class ClassificationDto {
  @IsIn(['co-curricular', 'extra-curricular'])
  activity_type!: 'co-curricular' | 'extra-curricular';

  @IsInt()
  @Min(0)
  total_org_members!: number;

  @IsOptional()
  @IsIn(['major', 'minor', 'Major', 'Minor'])
  nature?: string;
}

export class ProponentDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  position_title?: string;

  @IsString()
  @Matches(/^[^\d]*$/, NO_DIGITS)
  first_name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[^\d]*$/, NO_DIGITS)
  middle_name?: string;

  @IsString()
  @Matches(/^[^\d]*$/, NO_DIGITS)
  last_name!: string;

  @IsOptional()
  @IsString()
  suffix?: string;

  @IsOptional()
  @IsString()
  student_number?: string;

  @IsOptional()
  @IsString()
  program_and_year?: string;

  @IsOptional()
  @IsString()
  date_of_submission?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsString()
  @Matches(/^[^\d]*$/, {
    message: 'The position of the applicant cannot contain numbers.',
  })
  position_of_applicant!: string;

  @IsOptional()
  @IsString()
  org_or_course_section?: string;

  @IsOptional()
  @IsString()
  contact_number?: string;

  @IsEmail()
  email_address!: string;

  @IsOptional()
  @IsString()
  facebook_link?: string;
}

export class ActivityDetailsDto {
  @IsString()
  @MinLength(1)
  title_and_nature!: string;

  @IsString()
  description!: string;

  @IsString()
  objectives!: string;

  @IsString()
  venue!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date_of_event!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'The end date of event must be on or after the start date.',
  })
  end_date_of_event?: string;

  @IsOptional()
  @IsString()
  day_of_event?: string;

  @IsString()
  time_of_event!: string;

  @IsNumber()
  expected_participants!: number;

  @IsNumber()
  individual_contribution!: number;

  @IsNumber()
  proposed_budget!: number;
}

export class MissionDto {
  @IsBoolean()
  competitive!: boolean;

  @IsBoolean()
  research!: boolean;

  @IsBoolean()
  solutions!: boolean;
}

export class AlignmentDto {
  @ValidateNested()
  @Type(() => MissionDto)
  mission_statements!: MissionDto;

  @IsString()
  core_values_explanation!: string;

  @IsOptional()
  @IsString()
  peo_explanation?: string;

  @IsString()
  sdg_explanation!: string;
}

export class BudgetItemDto {
  @IsString()
  item_no!: string;

  @IsString()
  @MaxLength(10, { message: 'Unit cannot exceed 10 characters.' })
  unit!: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  price_per_unit!: number;

  @IsNumber()
  total!: number;
}

export class BudgetDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BudgetItemDto)
  items!: BudgetItemDto[];

  @IsNumber()
  grand_total!: number;
}

export class SelectionDto {
  @IsString()
  date!: string;

  @IsArray()
  @ArrayMinSize(1)
  slots!: number[];
}

export class ReservationDto {
  @IsString()
  reservable_id!: string;

  @IsString()
  campus_id!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsIn(['room', 'equipment'])
  type!: 'room' | 'equipment';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectionDto)
  selections!: SelectionDto[];

  @IsString()
  @MinLength(1)
  @MaxLength(255, {
    message: 'Each reserved room or equipment needs a purpose.',
  })
  remarks!: string;
}

export class VenueDto {
  @IsBoolean()
  has_reservation!: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReservationDto)
  reservations?: ReservationDto[];
}

export class CollaborationDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependent_organization_ids?: string[];
}

export class SaafDto {
  @IsString()
  submission_type!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CollaborationDto)
  collaboration?: CollaborationDto;

  @ValidateNested()
  @Type(() => ClassificationDto)
  activity_classification!: ClassificationDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProponentDto)
  proponents!: ProponentDto[];

  @ValidateNested()
  @Type(() => ActivityDetailsDto)
  activity_details!: ActivityDetailsDto;

  @ValidateNested()
  @Type(() => AlignmentDto)
  institutional_alignment!: AlignmentDto;

  @ValidateNested()
  @Type(() => BudgetDto)
  detailed_budget_proposal!: BudgetDto;

  @ValidateNested()
  @Type(() => VenueDto)
  venue_reservation!: VenueDto;
}

export class CreateSaafDto extends SaafDto {
  @IsString()
  event_id!: string;
}

export class CommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  comment!: string;
}

export class ClassificationPatchDto {
  @IsIn(['major', 'minor', 'Major', 'Minor'])
  nature!: string;
}

void IsObject;
