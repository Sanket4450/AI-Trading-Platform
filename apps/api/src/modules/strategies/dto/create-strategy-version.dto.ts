import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateStrategyVersionDto {
  @ApiProperty({
    description: 'Code reference for the strategy implementation.',
    minLength: 1,
    maxLength: 120,
    example: 'strategies.orb.v1',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  codeRef!: string;

  @ApiProperty({
    description: 'JSON schema describing the strategy parameters.',
    type: Object,
    additionalProperties: true,
  })
  @IsObject()
  parameterSchema!: Record<string, unknown>;

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  changelog?: string;
}
