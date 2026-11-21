import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_CURSOR_LENGTH,
  PAGINATION_MAX_LIMIT,
  type PaginationMode,
} from '@ai-trading/domain';

export class PaginationMetaDto {
  @ApiProperty({ enum: ['cursor', 'offset'] })
  mode!: PaginationMode;

  @ApiProperty({ minimum: 1, maximum: PAGINATION_MAX_LIMIT })
  limit!: number;

  @ApiProperty({ description: 'Exact row count for the request filters.' })
  total!: number;

  @ApiProperty()
  hasMore!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cursor for the next (older) page in cursor mode.',
  })
  nextCursor!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cursor for the previous (newer) page in cursor mode.',
  })
  prevCursor!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Window start in offset mode.',
  })
  offset!: number | null;
}

export class OffsetQueryDto {
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

  @ApiPropertyOptional({ type: Number, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class CursorQueryDto {
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
    description: 'Continue with rows older than this cursor.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(PAGINATION_MAX_CURSOR_LENGTH)
  after?: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: PAGINATION_MAX_CURSOR_LENGTH,
    description: 'Continue with rows newer than this cursor.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(PAGINATION_MAX_CURSOR_LENGTH)
  before?: string;
}
