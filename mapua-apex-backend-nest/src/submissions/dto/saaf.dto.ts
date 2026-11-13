import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  Equals,
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
import { PRIVACY_NOTICE_VERSION } from '../../privacy/privacy-notice.js';
import { TERMS_NOTICE_VERSION } from '../../terms/terms-notice.js';

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

  /** Nature-of-activity multi-select (S-2); distinct from the OSAAR `nature`. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nature_of_activity?: string[];
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

  /** Campus the officer is from (S-7); department is chosen within it. */
  @IsOptional()
  @IsString()
  campus?: string;

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

  /** On-campus / off-campus chosen in the start questionnaire (S-5). */
  @IsOptional()
  @IsIn(['on-campus', 'off-campus'])
  campus_location?: string;

  /** Mapua participant count (S-6); expected_participants stays the total. */
  @IsOptional()
  @IsNumber()
  mapua_participants?: number;

  /** Non-Mapua participant count (S-6); zero unless the switch is on. */
  @IsOptional()
  @IsNumber()
  non_mapua_participants?: number;

  /** Whether non-Mapua participants are included (S-6). */
  @IsOptional()
  @IsBoolean()
  has_non_mapua?: boolean;
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

export const FUNDING_SOURCES = [
  'sponsors',
  'concessionaires',
  'department',
  'organization',
  'member_contributions',
  'others',
] as const;

export class BudgetDto {
  /** False for a no-budget submission; a missing key means an older paper that always had a budget. */
  @IsOptional()
  @IsBoolean()
  has_budget?: boolean;

  /** Funding sources picked on the proposal setup step; optional so legacy and API-shaped payloads keep filing. */
  @IsOptional()
  @IsArray()
  @IsIn(FUNDING_SOURCES, { each: true })
  funding_sources?: string[];

  /** Free-text note attached to the budget; optional so legacy and no-budget papers keep filing. */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'The budget note cannot exceed 500 characters.' })
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetItemDto)
  items?: BudgetItemDto[];

  @IsOptional()
  @IsNumber()
  grand_total?: number;
}

export class SelectionDto {
  @IsString()
  date!: string;

  @IsArray()
  @ArrayMinSize(1)
  slots!: number[];
}

/** A room-specific equipment selection on a room reservation (S-8). */
export class RoomEquipmentSelectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

/** Outside (non-Mapua) equipment the CDM must rule on item-by-item (S-8). */
export class OutsideEquipmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;
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

  /** Room-specific equipment picked for this room reservation (S-8). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomEquipmentSelectionDto)
  room_equipment?: RoomEquipmentSelectionDto[];
}

export class VenueDto {
  @IsBoolean()
  has_reservation!: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReservationDto)
  reservations?: ReservationDto[];

  /** Outside equipment listed for CDM ruling (S-8). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutsideEquipmentDto)
  outside_equipment?: OutsideEquipmentDto[];
}

export class CollaborationDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependent_organization_ids?: string[];
}

/**
 * RA 10173 consent as sent by the pre-submit dialog. `version` is pinned to the
 * current notice version, so bumping `PRIVACY_NOTICE_VERSION` makes every older
 * client payload fail validation and forces a re-accept. Optional on `SaafDto`
 * so the admin `PUT` keeps validating; the student write path enforces presence
 * in the service (see `submission-writer.service.ts`).
 */
export class PrivacyConsentDto {
  @IsIn([PRIVACY_NOTICE_VERSION])
  version!: string;

  @IsBoolean()
  @Equals(true)
  accepted!: boolean;
}

/**
 * SAAF Terms & Conditions consent (S-1), parallel to `PrivacyConsentDto`.
 * `version` is pinned to the current notice version; optional on `SaafDto` so
 * the admin `PUT` keeps validating, enforced on the student write path.
 */
export class TermsConsentDto {
  @IsIn([TERMS_NOTICE_VERSION])
  version!: string;

  @IsBoolean()
  @Equals(true)
  accepted!: boolean;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => PrivacyConsentDto)
  privacy_consent?: PrivacyConsentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TermsConsentDto)
  terms_consent?: TermsConsentDto;
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

/** One CDM ruling for an outside-equipment item (S-8). */
export class OutsideEquipmentDecisionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsBoolean()
  allowed!: boolean;
}

/** PATCH payload for the CDM outside-equipment decisions endpoint (S-8). */
export class OutsideEquipmentPatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutsideEquipmentDecisionDto)
  decisions!: OutsideEquipmentDecisionDto[];
}

void IsObject;
