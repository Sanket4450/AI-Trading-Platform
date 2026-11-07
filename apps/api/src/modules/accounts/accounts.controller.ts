import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/auth/current-user.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { SearchQueryDto } from '../../common/dto/search-query.dto.js';
import { requestMeta } from '../../common/http/request-meta.js';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { AccountsService } from './accounts.service.js';
import {
  AccountAccessDto,
  AccountDto,
  AccountPermissionDto,
  BrokerCredentialDto,
  EquitySnapshotDto,
  TradingSessionDto,
} from './dto/account-response.dto.js';
import { CreateCredentialDto } from './dto/create-credential.dto.js';

@ApiTags('accounts')
@ApiSessionAuth()
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @ApiOperation({
    summary: 'List broker accounts with current equity and permission counts',
  })
  @ApiOkResponse({ type: AccountDto, isArray: true })
  list(@Query() query: SearchQueryDto) {
    return this.accounts.list(query.search);
  }

  @Get(':id/permissions')
  @ApiOperation({
    summary: 'List tradable instrument permissions for an account',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AccountPermissionDto, isArray: true })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Account not found',
  })
  permissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.permissions(id);
  }

  @Get(':id/credentials')
  @ApiOperation({
    summary: 'List stored credential metadata (never the secret value)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: BrokerCredentialDto, isArray: true })
  credentials(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.credentials(id);
  }

  @Get(':id/access')
  @ApiOperation({ summary: 'List operator access grants for an account' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AccountAccessDto, isArray: true })
  access(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.access(id);
  }

  @Get(':id/equity')
  @ApiOperation({ summary: 'List recent equity snapshots for an account' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EquitySnapshotDto, isArray: true })
  equity(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.equity(id);
  }

  @Get(':id/sessions')
  @ApiOperation({ summary: 'List trading sessions for an account' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TradingSessionDto, isArray: true })
  sessions(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.sessions(id);
  }

  @Post(':id/credentials')
  @ApiOperation({
    summary: 'Create or rotate an encrypted broker credential',
    description:
      'Requires the account to expose a broker user reference before any secret can be stored.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: BrokerCredentialDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Account not found',
  })
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
