import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class DaySlotsDto {
  @IsArray()
  @ArrayMinSize(12)
  @ArrayMaxSize(12)
  @IsBoolean({ each: true })
  slots!: boolean[];
}

export class ReservableDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsIn(['room', 'equipment'])
  type!: 'room' | 'equipment';

  @IsObject()
  schedule!: Record<string, boolean[]>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3000)
  min_participants?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3000)
  max_participants?: number | null;

  @IsOptional()
  @IsBoolean()
  is_classroom?: boolean | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_quantity?: number | null;
}

void DaySlotsDto;
void Type;
void ValidateNested;
