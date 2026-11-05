import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';

export const CONFIGURATION_ROLES = [
  'parameters',
  'risk',
  'execution',
] as const;

export class EffectiveConfigQueryDto {
  @ApiPropertyOptional({
    enum: [...CONFIGURATION_ROLES],
    default: 'parameters',
  })
  @IsOptional()
  @IsIn(CONFIGURATION_ROLES)
  role?: (typeof CONFIGURATION_ROLES)[number];

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Effective timestamp; defaults to now.',
  })
  @IsOptional()
  @IsISO8601()
  at?: string;
}
