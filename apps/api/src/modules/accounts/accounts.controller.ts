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
import { CursorQueryDto, OffsetQueryDto } from '../../common/pagination/pagination.dto.js';
import { SearchOffsetQueryDto } from '../../common/pagination/search-offset-query.dto.js';
import { requestMeta } from '../../common/http/request-meta.js';
import { ApiSessionAuth } from '../../common/swagger/api-session-auth.decorator.js';
import { AccountsService } from './accounts.service.js';
import {
  AccountAccessListResponseDto,
  AccountDto,
  AccountListResponseDto,
  AccountPermissionListResponseDto,
  AccountSummaryDto,
  BrokerCredentialDto,
  EquitySnapshotListResponseDto,
  TradingSessionListResponseDto,
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
  @ApiOkResponse({ type: AccountListResponseDto })
  list(@Query() query: SearchOffsetQueryDto) {
    return this.accounts.list(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Summarise the account registry' })
  @ApiOkResponse({ type: AccountSummaryDto })
  summary(@Query() query: SearchOffsetQueryDto) {
    return this.accounts.summary(query);
  }

  @Get(':id/permissions')
  @ApiOperation({
    summary: 'List tradable instrument permissions for an account',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AccountPermissionListResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Account not found',
  })
  permissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: OffsetQueryDto,
  ) {
    return this.accounts.permissions(id, query);
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
  @ApiOkResponse({ type: AccountAccessListResponseDto })
  access(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: OffsetQueryDto,
  ) {
    return this.accounts.access(id, query);
  }

  @Get(':id/equity')
  @ApiOperation({ summary: 'List recent equity snapshots for an account' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: EquitySnapshotListResponseDto })
  equity(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CursorQueryDto,
  ) {
    return this.accounts.equity(id, query);
  }

  @Get(':id/sessions')
  @ApiOperation({ summary: 'List trading sessions for an account' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TradingSessionListResponseDto })
  sessions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CursorQueryDto,
  ) {
    return this.accounts.sessions(id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return one broker account' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AccountDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Account not found' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.detail(id);
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
