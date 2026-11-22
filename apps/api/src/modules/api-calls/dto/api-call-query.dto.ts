import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { EXTERNAL_API_OUTCOMES, EXTERNAL_API_SERVICES } from '@ai-trading/domain';
import { CursorQueryDto } from '../../../common/pagination/pagination.dto.js';

function toList(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;

  const items: unknown[] = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const values: string[] = [];
  for (const item of items) {
    if (typeof item === 'string') values.push(item.trim());
    else if (typeof item === 'number' || typeof item === 'boolean') values.push(String(item));
  }
  return values.filter(Boolean);
}

export class ApiCallQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({
    enum: [...EXTERNAL_API_SERVICES],
    isArray: true,
    description: 'Repeat the parameter or comma-separate multiple services.',
  })
  @IsOptional()
  @Transform(({ value }) => toList(value))
  @IsArray()
  @IsIn(EXTERNAL_API_SERVICES, { each: true })
  service?: string[];

  @ApiPropertyOptional({
    enum: [...EXTERNAL_API_OUTCOMES],
    isArray: true,
    description: 'Repeat the parameter or comma-separate multiple outcomes.',
  })
  @IsOptional()
  @Transform(({ value }) => toList(value))
  @IsArray()
  @IsIn(EXTERNAL_API_OUTCOMES, { each: true })
  outcome?: string[];

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Case-insensitive match on operation, service, instrument symbol or job name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
