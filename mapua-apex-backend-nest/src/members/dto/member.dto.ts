import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class MemberDto {
  @IsString()
  @MaxLength(32)
  student_number!: string;

  @IsString()
  @MaxLength(64)
  lastname!: string;

  @IsString()
  @MaxLength(64)
  firstname!: string;
}

export class UpdateMemberDto {
  @IsString()
  @MaxLength(64)
  lastname!: string;

  @IsString()
  @MaxLength(64)
  firstname!: string;
}

export class BulkMembersDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => MemberDto)
  members!: MemberDto[];
}
