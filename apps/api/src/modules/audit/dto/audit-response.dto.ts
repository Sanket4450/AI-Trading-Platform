import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/pagination/pagination.dto.js';

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

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  requestId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class AuditDetailDto extends AuditRowDto {
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
}

export class AuditListResponseDto {
  @ApiProperty({ type: [AuditRowDto] })
  items!: AuditRowDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}

export class AuditSummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  actors!: number;

  @ApiProperty()
  entityTypes!: number;
}
