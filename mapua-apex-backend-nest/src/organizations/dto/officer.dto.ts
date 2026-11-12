import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateOfficerDto {
  @IsString()
  @MaxLength(60)
  first_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  middle_name?: string;

  @IsString()
  @MaxLength(60)
  last_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  suffix?: string;

  @IsString()
  @MaxLength(20)
  student_number!: string;

  @IsString()
  @MaxLength(100)
  program_and_year!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  department?: string;

  @IsString()
  @MaxLength(80)
  position_of_applicant!: string;

  @IsString()
  @Matches(/^09\d{9}$/, { message: 'contact_number must be an 11-digit PH mobile number starting with 09' })
  contact_number!: string;

  @IsEmail()
  @MaxLength(150)
  email_address!: string;

  @IsString()
  @MaxLength(300)
  facebook_link!: string;
}

export class UpdateOfficerDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  first_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  middle_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  last_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  suffix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  student_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  program_and_year?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  position_of_applicant?: string;

  @IsOptional()
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'contact_number must be an 11-digit PH mobile number starting with 09' })
  contact_number?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email_address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  facebook_link?: string;
}

