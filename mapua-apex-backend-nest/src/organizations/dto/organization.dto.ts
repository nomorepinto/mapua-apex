import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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

  /** Optional list of named position roles the org exposes for the SAAF form. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  position_roles?: string[];
}

export class UpdateOrganizationDto extends OrganizationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeskDto)
  declare signatories: DeskDto[];
}

/** Student-only DTO: replace the org's position_roles list in-place. */
export class UpdateOrgRolesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  position_roles!: string[];
}
