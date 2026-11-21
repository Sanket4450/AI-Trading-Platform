import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/pagination/pagination.dto.js';

export class AccountDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'upstox-primary' })
  code!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ format: 'uuid' })
  brokerProviderId!: string;

  @ApiProperty({ type: String, nullable: true })
  brokerUserRef!: string | null;

  @ApiProperty({ example: 'INR' })
  baseCurrency!: string;

  @ApiProperty({
    enum: ['offline', 'research', 'backtesting', 'paper', 'live'],
  })
  mode!: string;


  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  openedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  latestEquityAt!: string | null;

  @ApiProperty({ example: 50 })
  permissionCount!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  credentialExpiry!: string | null;

  @ApiProperty({ example: 0 })
  openSessionCount!: number;
}

export class AccountPermissionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ example: 'RELIANCE' })
  symbol!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isTradable!: boolean;

  @ApiProperty({ type: [String], example: ['intraday', 'delivery'] })
  productAllowlist!: string[];

  @ApiProperty({ type: String, format: 'date' })
  effectiveFrom!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  effectiveTo!: string | null;
}

export class BrokerCredentialDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  accountId!: string;

  @ApiProperty({ format: 'uuid' })
  providerId!: string;

  @ApiProperty({
    enum: [
      'api_key',
      'api_secret',
      'access_token',
      'refresh_token',
      'totp_secret',
    ],
  })
  credentialType!: string;

  @ApiProperty({ example: 1 })
  encryptionKeyVersion!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  expiresAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  rotatedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', required: false })
  createdAt?: string;
}

export class AccountAccessDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: ['owner', 'trader', 'viewer'] })
  role!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  grantedAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  expiresAt!: string | null;
}

export class EquitySnapshotDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  accountId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  capturedAt!: string;

  @ApiProperty({ type: String, format: 'date' })
  tradingDate!: string;

  @ApiProperty({
    enum: ['session_open', 'intraday', 'session_close', 'broker_sync'],
  })
  snapshotType!: string;

  @ApiProperty({ type: String, nullable: true })
  availableCash!: string | null;

  @ApiProperty({ enum: ['broker', 'computed'] })
  source!: string;
}

export class TradingSessionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  accountId!: string;

  @ApiProperty({ example: 'upstox-primary' })
  accountCode!: string;

  @ApiProperty({ type: String, format: 'date' })
  tradingDate!: string;

  @ApiProperty({ enum: ['research', 'backtesting', 'paper', 'live'] })
  mode!: string;

  @ApiProperty({ enum: ['scheduled', 'open', 'closed', 'aborted'] })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  endedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  openingEquity!: string | null;

  @ApiProperty({ type: String, nullable: true })
  closingEquity!: string | null;

  @ApiProperty()
  killSwitchEngaged!: boolean;
}

export class AccountListResponseDto {
  @ApiProperty({ type: [AccountDto] })
  items!: AccountDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}

export class AccountSummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  active!: number;

  @ApiProperty()
  permissionTotal!: number;

  @ApiProperty()
  credentialsTracked!: number;
}

export class AccountPermissionListResponseDto {
  @ApiProperty({ type: [AccountPermissionDto] })
  items!: AccountPermissionDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}

export class AccountAccessListResponseDto {
  @ApiProperty({ type: [AccountAccessDto] })
  items!: AccountAccessDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}

export class EquitySnapshotListResponseDto {
  @ApiProperty({ type: [EquitySnapshotDto] })
  items!: EquitySnapshotDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}

export class TradingSessionListResponseDto {
  @ApiProperty({ type: [TradingSessionDto] })
  items!: TradingSessionDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}
