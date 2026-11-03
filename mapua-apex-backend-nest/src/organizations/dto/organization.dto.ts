import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const DESK_ROLES = ['adviser', 'dean', 'osaar', 'cdm', 'admin'] as const;

export class DeskDto {
  @IsIn(DESK_ROLES)
  role!: (typeof DESK_ROLES)[number];

  @IsString()
  @MaxLength(64)
  signatory_id!: string;
}

export class OrganizationDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsBoolean()
  skip_dean?: boolean;

  @IsOptional()
  @IsBoolean()
  skip_post_eval?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeskDto)
  signatories?: DeskDto[];
}

export class UpdateOrganizationDto extends OrganizationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeskDto)
  declare signatories: DeskDto[];
}
