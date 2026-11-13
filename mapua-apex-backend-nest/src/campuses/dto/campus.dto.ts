import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** A course/program offered under a department (C-1 campus master data). */
export class CourseDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(200)
  name!: string;
}

/** A department belonging to a campus, with its courses (C-1). */
export class DepartmentDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CourseDto)
  courses?: CourseDto[];
}

export class CampusDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  /** The single campus whose OSAARs review online events. */
  @IsOptional()
  @IsBoolean()
  main?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @Matches(/^[A-Za-z]{1,10}$/, { each: true })
  classroom_name_prefixes?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  classroom_name_digits?: number | null;

  /** Departments (each with courses) offered at this campus (C-1). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DepartmentDto)
  departments?: DepartmentDto[];
}
