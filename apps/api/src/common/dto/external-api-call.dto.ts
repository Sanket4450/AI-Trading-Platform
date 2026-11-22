import { ApiProperty } from '@nestjs/swagger';
import { EXTERNAL_API_OUTCOMES, EXTERNAL_API_SERVICES } from '@ai-trading/domain';
import { PaginationMetaDto } from '../pagination/pagination.dto.js';

export class ApiCallScopeDto {
  @ApiProperty({ type: Object, description: 'Path parameter values exactly as sent.' })
  path!: Record<string, string>;

  @ApiProperty({ type: Object, description: 'Query parameter values exactly as sent.' })
  query!: Record<string, string>;

  @ApiProperty({ type: Object, description: 'Request body for write operations; empty for GET.' })
  body!: Record<string, unknown>;
}

export class ExternalApiCallDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  jobRunId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Job name when the run still exists.' })
  jobName!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  instrumentId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  instrumentSymbol!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  startedAt!: string;

  @ApiProperty({ description: 'Network exchange duration in milliseconds.' })
  latencyMs!: number;

  @ApiProperty({ enum: [...EXTERNAL_API_SERVICES] })
  service!: string;

  @ApiProperty({ description: 'Catalogue operation key.' })
  operation!: string;

  @ApiProperty({ description: 'HTTP method resolved from the operation catalogue.' })
  method!: string;

  @ApiProperty({ description: 'Path template from the operation catalogue.' })
  endpoint!: string;

  @ApiProperty({ description: 'Concrete request URL rebuilt from the template and scope.' })
  url!: string;

  @ApiProperty({ type: ApiCallScopeDto })
  requestScope!: ApiCallScopeDto;

  @ApiProperty({ type: Number, nullable: true, description: 'Null when no response arrived.' })
  statusCode!: number | null;

  @ApiProperty({ enum: [...EXTERNAL_API_OUTCOMES] })
  outcome!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Provider error payload, capped at 8 KB. Null for successful calls.',
  })
  errorBody!: string | null;
}

export class ApiCallOutcomeCountDto {
  @ApiProperty({ enum: [...EXTERNAL_API_OUTCOMES] })
  outcome!: string;

  @ApiProperty()
  count!: number;
}

export class ApiCallSummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  p95LatencyMs!: number;

  @ApiProperty()
  maxLatencyMs!: number;

  @ApiProperty({ type: [ApiCallOutcomeCountDto] })
  outcomes!: ApiCallOutcomeCountDto[];
}

export class ExternalApiCallListResponseDto {
  @ApiProperty({ type: [ExternalApiCallDto] })
  items!: ExternalApiCallDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;

  @ApiProperty({ type: ApiCallSummaryDto })
  summary!: ApiCallSummaryDto;
}
