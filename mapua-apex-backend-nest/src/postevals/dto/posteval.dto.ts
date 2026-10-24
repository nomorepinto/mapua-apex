import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const AMOUNT = { message: 'Each actual amount may not exceed 5 digits.' };

class BudgetLineDto {
  @IsString()
  @MaxLength(255)
  item!: string;

  @IsOptional()
  unit?: unknown;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999)
  budgeted_total?: number;

  @IsNumber({}, AMOUNT)
  @Min(0)
  @Max(99999, AMOUNT)
  actual_amount!: number;
}

class AddedLineDto extends BudgetLineDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999)
  price_per_unit?: number;
}

class FinancialReportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetLineDto)
  budget_items!: BudgetLineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddedLineDto)
  added_items!: AddedLineDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  initial_grand_total?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  actual_grand_total?: number;
}

export class StorePostEvalDto {
  @IsString()
  @MaxLength(64)
  event_id!: string;

  @IsString()
  @MaxLength(64)
  submission_id!: string;

  @IsString()
  @MinLength(100, {
    message: 'The event summary must be at least 100 characters.',
  })
  @MaxLength(500, {
    message: 'The event summary may not exceed 500 characters.',
  })
  section_summary!: string;

  @ValidateNested()
  @Type(() => FinancialReportDto)
  financial_report!: FinancialReportDto;
}
