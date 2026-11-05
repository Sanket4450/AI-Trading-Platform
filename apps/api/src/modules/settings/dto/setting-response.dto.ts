import { ApiProperty } from '@nestjs/swagger';

export class SystemSettingDto {
  @ApiProperty({ example: 'risk.max_daily_loss' })
  key!: string;

  @ApiProperty({
    description: 'Arbitrary JSON value.',
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'object', additionalProperties: true },
      { type: 'array', items: {} },
      { type: 'null' },
    ],
  })
  value!: unknown;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
