import { ApiProperty } from '@nestjs/swagger';

export class InstrumentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  exchangeId!: string;

  @ApiProperty({ example: 'NSE' })
  exchangeCode!: string;

  @ApiProperty({ example: 'RELIANCE' })
  tradingSymbol!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  shortName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  isin!: string | null;

  @ApiProperty({
    enum: ['NSE_EQ', 'BSE_EQ', 'NSE_INDEX', 'BSE_INDEX'],
  })
  segment!: string;

  @ApiProperty({ example: 'EQ' })
  instrumentType!: string;

  @ApiProperty({ example: 1 })
  lotSize!: number;

  @ApiProperty({ example: '0.05' })
  tickSize!: string;

  @ApiProperty({ type: String, nullable: true })
  freezeQuantity!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  listedOn!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  delistedOn!: string | null;

  @ApiProperty({ required: false, example: 1 })
  mappingCount?: number;
}

export class InstrumentMappingDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  providerId!: string;

  @ApiProperty({ example: 'upstox' })
  providerCode!: string;

  @ApiProperty()
  providerName!: string;

  @ApiProperty()
  externalKey!: string;

  @ApiProperty({ type: String, nullable: true })
  exchangeToken!: string | null;

  @ApiProperty({ type: String, nullable: true })
  providerSymbol!: string | null;

  @ApiProperty({ type: String, nullable: true })
  providerSegment!: string | null;

  @ApiProperty()
  isPrimary!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  validFrom!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  validTo!: string | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    required: false,
  })
  rawPayloadId?: string | null;
}

export class CorporateActionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ example: 'RELIANCE' })
  symbol!: string;

  @ApiProperty({
    enum: [
      'split',
      'bonus',
      'dividend',
      'merger',
      'demerger',
      'rights',
      'symbol_change',
    ],
  })
  actionType!: string;

  @ApiProperty({ type: String, format: 'date' })
  exDate!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  recordDate!: string | null;

  @ApiProperty({ type: String, nullable: true })
  ratioNumerator!: string | null;

  @ApiProperty({ type: String, nullable: true })
  ratioDenominator!: string | null;

  @ApiProperty({ type: String, nullable: true })
  dividendPerShare!: string | null;

  @ApiProperty({ example: '1' })
  priceAdjustmentFactor!: string;

  @ApiProperty({ example: '1' })
  volumeAdjustmentFactor!: string;

  @ApiProperty()
  source!: string;

  @ApiProperty({ enum: ['announced', 'confirmed', 'applied'] })
  status!: string;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;
}

export class CandleDto {
  @ApiProperty({ format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  candleStart!: string;

  @ApiProperty({ type: String, format: 'date' })
  tradingDate!: string;

  @ApiProperty({ example: '2500.10' })
  open!: string;

  @ApiProperty({ example: '2505.00' })
  high!: string;

  @ApiProperty({ example: '2498.50' })
  low!: string;

  @ApiProperty({ example: '2503.75' })
  close!: string;

  @ApiProperty({ example: '18234.0000' })
  volume!: string;

  @ApiProperty()
  isFinal!: boolean;
}
