import {
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
}
