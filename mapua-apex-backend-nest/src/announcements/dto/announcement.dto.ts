import { IsString, MaxLength, MinLength } from 'class-validator';

export class AnnouncementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;
}
