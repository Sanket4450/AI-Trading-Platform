import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class InstrumentCandlesQueryDto {
  @ApiPropertyOptional({
    format: 'date',
    description: 'Inclusive lower bound; defaults to five days before `to`.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Inclusive upper bound; defaults to today (IST).',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
