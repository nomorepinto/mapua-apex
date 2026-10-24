import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CampusDto {
  @IsString()
  @MaxLength(150)
  name!: string;

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
}
