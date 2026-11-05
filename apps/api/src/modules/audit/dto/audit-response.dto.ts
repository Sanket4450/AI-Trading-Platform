import { ApiProperty } from '@nestjs/swagger';

export class AuditRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  actorUserId!: string | null;

  @ApiProperty({ type: String, format: 'email', nullable: true })
  actorEmail!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  accountId!: string | null;

  @ApiProperty({ example: 'configuration.created' })
  action!: string;

  @ApiProperty({ example: 'configuration_version' })
  entityType!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  entityId!: string | null;

  @ApiProperty({
    type: Object,
    additionalProperties: true,
    nullable: true,
  })
  beforeState!: Record<string, unknown> | null;

  @ApiProperty({
    type: Object,
    additionalProperties: true,
    nullable: true,
  })
  afterState!: Record<string, unknown> | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  requestId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
