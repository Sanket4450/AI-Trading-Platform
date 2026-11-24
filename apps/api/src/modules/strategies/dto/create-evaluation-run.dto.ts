import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEvaluationRunDto {
  @ApiProperty({ format: 'uuid', description: 'Strategy version to evaluate.' })
  @IsUUID()
  strategyVersionId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Explicit parameter configuration version; defaults to the effective binding.',
  })
  @IsOptional()
  @IsUUID()
  configurationVersionId?: string;

  @ApiProperty({ example: '2026-09-01', description: 'Inclusive IST start date.' })
  @IsDateString()
  fromDate!: string;

  @ApiProperty({ example: '2026-09-30', description: 'Inclusive IST end date.' })
  @IsDateString()
  toDate!: string;

  @ApiProperty({ example: 1000000, minimum: 0.01, description: 'Fixed capital base for the run.' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  initialCapital!: number;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Optional subset of sync-target equities; defaults to every sync-target equity.',
    maxItems: 200,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  instrumentIds?: string[];

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
