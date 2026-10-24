import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/auth/current-user.decorator.js';
import { requestMeta } from '../../common/http/request-meta.js';
import { AccountsService } from './accounts.service.js';
import { CreateCredentialDto } from './dto/create-credential.dto.js';

@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list() {
    return this.accounts.list();
  }

  @Get(':id/permissions')
  permissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.permissions(id);
  }

  @Get(':id/credentials')
  credentials(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.credentials(id);
  }

  @Get(':id/access')
  access(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.access(id);
  }

  @Get(':id/equity')
  equity(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.equity(id);
  }

  @Get(':id/sessions')
  sessions(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.sessions(id);
  }

  @Post(':id/credentials')
  storeCredential(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateCredentialDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const meta = requestMeta(request);
    return this.accounts.storeCredential(
      id,
      body,
      user.id,
      meta.requestId,
      meta.ipAddress,
      meta.userAgent,
    );
  }
}
