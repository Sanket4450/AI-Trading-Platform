import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { OffsetQueryDto } from './pagination.dto.js';

/** Offset page plus the shared free-text filter used by registry-style lists. */
export class SearchOffsetQueryDto extends OffsetQueryDto {
  @ApiPropertyOptional({
    maxLength: 120,
    description:
      'Case-insensitive substring match across the list endpoint’s searchable fields.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
