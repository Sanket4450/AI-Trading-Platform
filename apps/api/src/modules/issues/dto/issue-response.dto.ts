import { ApiProperty } from '@nestjs/swagger';
import { SystemIssueDto } from '../../../common/dto/system-issue.dto.js';
import { PaginationMetaDto } from '../../../common/pagination/pagination.dto.js';

export class SystemIssueListResponseDto {
  @ApiProperty({ type: [SystemIssueDto] })
  items!: SystemIssueDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}

export class IssueSummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  critical!: number;

  @ApiProperty()
  instrumentScoped!: number;

  @ApiProperty()
  providerScoped!: number;
}
