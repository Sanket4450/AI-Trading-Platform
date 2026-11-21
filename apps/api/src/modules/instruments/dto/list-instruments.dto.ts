import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBooleanString,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { OffsetQueryDto } from '../../../common/pagination/pagination.dto.js';

export const INSTRUMENT_SEGMENTS = [
  'NSE_EQ',
  'BSE_EQ',
  'NSE_INDEX',
  'BSE_INDEX',
] as const;

export class ListInstrumentsDto extends OffsetQueryDto {
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
}
