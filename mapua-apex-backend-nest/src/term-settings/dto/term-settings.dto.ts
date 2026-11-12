import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BlackoutDto {
  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;

  @IsString()
  @MaxLength(200)
  reason!: string;
}

export class UpdateTermSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  event_filing_lead_days?: number;

  @IsString()
  @MaxLength(40)
  active_academic_year_id!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AcademicYearDto)
  academic_years!: AcademicYearDto[];
}

export class AcademicYearDto {
  @IsString()
  @MaxLength(40)
  id!: string;

  @IsString()
  @MaxLength(100)
  label!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => AcademicTermDto)
  terms!: AcademicTermDto[];
}

export class AcademicTermDto {
  @IsString()
  @MaxLength(40)
  id!: string;

  @IsString()
  @MaxLength(100)
  label!: string;

  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BlackoutDto)
  blackouts!: BlackoutDto[];
}
