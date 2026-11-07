import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Shared free-text query used by list endpoints to match several columns at once. */
export class SearchQueryDto {
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
