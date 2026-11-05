import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @ApiProperty({
    description:
      'Any JSON value. Objects and arrays are stored verbatim; scalars are stored as-is.',
    example: { enabled: true },
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'object', additionalProperties: true },
      { type: 'array', items: {} },
      { type: 'null' },
    ],
  })
  @IsDefined()
  value!: unknown;

  @ApiPropertyOptional({
    description: 'Optional human-readable description for the setting.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
