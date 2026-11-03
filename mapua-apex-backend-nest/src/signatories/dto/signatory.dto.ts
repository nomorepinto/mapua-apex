import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const ROLES = ['adviser', 'cdm', 'dean', 'osaar', 'admin'] as const;

export class SignatoryDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsIn(ROLES, { message: 'The selected role is invalid.' })
  role!: (typeof ROLES)[number];

  @ValidateIf((body: SignatoryDto) => body.role === 'dean')
  @IsOptional()
  @IsString()
  @MaxLength(32)
  department?: string | null;

  /** Required for an OSAAR account that belongs to one campus. */
  @ValidateIf((body: SignatoryDto) => body.role === 'osaar')
  @IsOptional()
  @IsString()
  @MaxLength(80)
  campus_id?: string | null;

  /** The single OSAAR account that approves every campus. */
  @ValidateIf((body: SignatoryDto) => body.role === 'osaar')
  @IsOptional()
  @IsBoolean()
  all_campuses?: boolean;
}
