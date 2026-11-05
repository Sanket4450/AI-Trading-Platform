import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const INSTRUMENT_SEGMENTS = [
  'NSE_EQ',
  'BSE_EQ',
  'NSE_INDEX',
  'BSE_INDEX',
] as const;

export class ListInstrumentsDto {
  @ApiPropertyOptional({ description: 'Case-insensitive symbol or name match.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: [...INSTRUMENT_SEGMENTS] })
  @IsOptional()
  @IsIn(INSTRUMENT_SEGMENTS)
  segment?: string;

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'When false, inactive instruments are included.',
  })
  @IsOptional()
  @IsBooleanString()
  active?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 1000, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
