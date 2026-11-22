import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_CURSOR_LENGTH,
  PAGINATION_MAX_LIMIT,
} from '@ai-trading/domain';

/** Chronological event feed of one run: `after` continues toward newer events. */
export class JobEventQueryDto {
  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: PAGINATION_MAX_LIMIT,
    default: PAGINATION_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINATION_MAX_LIMIT)
  limit?: number;

  @ApiPropertyOptional({
    type: String,
    maxLength: PAGINATION_MAX_CURSOR_LENGTH,
    description: 'Continue with events newer than this cursor.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(PAGINATION_MAX_CURSOR_LENGTH)
  after?: string;
}
