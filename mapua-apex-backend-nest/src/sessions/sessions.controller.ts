import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import {
  CurrentCaller,
  NoEnvelope,
  Roles,
  SkipSession,
} from '../common/decorators.js';
import { clientIp } from '../common/client-ip.js';
import type { AuthenticatedCaller } from '../common/caller.js';
import type { Item } from '../common/records.js';
import type { Request } from 'express';
import { Req } from '@nestjs/common';
import { SessionService, type SessionStartResult } from './session.service.js';

class StartSessionDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  existingSessionId?: string;

  @IsOptional()
  @IsArray()
  pagesVisited?: Item[];
}

class HeartbeatDto {
  @IsOptional()
  @IsArray()
  pagesVisited?: Item[];
}

class EndSessionDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  endReason?: string;
}

@Controller('sessions')
@Roles('any')
@SkipSession()
@NoEnvelope()
export class SessionsController {
  constructor(private readonly sessions: SessionService) {}

  @Post('start')
  start(
    @CurrentCaller() caller: AuthenticatedCaller,
    @Body() body: StartSessionDto,
    @Req() request: Request,
  ): Promise<SessionStartResult> {
    const authTime =
      typeof caller.claims.auth_time === 'number'
        ? caller.claims.auth_time
        : Math.floor(Date.now() / 1000);
    return this.sessions.start({
      sub: caller.sub,
      authTime,
      userName: caller.name || caller.email || 'Unknown User',
      userEmail: caller.email || 'unknown@mapua.edu.ph',
      userRole: caller.role || 'unknown',
      ipAddress: clientIp(request),
      userAgent: request.header('user-agent') ?? 'Unknown',
      pagesVisited: body.pagesVisited ?? [],
      existingSessionId: body.existingSessionId?.trim() || null,
      deviceId:
        body.deviceId?.trim() || request.header('x-device-id')?.trim() || null,
    });
  }

  @Patch(':sessionId/heartbeat')
  heartbeat(
    @CurrentCaller() caller: AuthenticatedCaller,
    @Param('sessionId') sessionId: string,
    @Body() body: HeartbeatDto,
  ): Promise<Item> {
    return this.sessions.heartbeat(
      sessionId,
      caller.sub,
      body.pagesVisited ?? [],
    );
  }

  @Post(':sessionId/end')
  end(
    @CurrentCaller() caller: AuthenticatedCaller,
    @Param('sessionId') sessionId: string,
    @Body() body: EndSessionDto,
  ): Promise<Item> {
    return this.sessions.end(
      sessionId,
      caller.sub,
      body.reason ?? body.endReason ?? 'logout',
    );
  }
}
