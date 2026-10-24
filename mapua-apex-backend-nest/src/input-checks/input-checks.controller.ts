import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { NoEnvelope, Public } from '../common/decorators.js';
import {
  InputCheckService,
  type EmailCheck,
  type GibberishCheck,
} from './input-check.service.js';

class GibberishDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;
}

@Controller('public')
@Public()
@NoEnvelope()
export class InputChecksController {
  constructor(private readonly checks: InputCheckService) {}

  @Get('validate-email')
  validateEmail(@Query('email') email?: string): Promise<EmailCheck> {
    return this.checks.validateEmail(email);
  }

  @Post('detect-gibberish')
  detect(@Body() body: GibberishDto): Promise<GibberishCheck> {
    return this.checks.detectGibberish(body.text);
  }
}
