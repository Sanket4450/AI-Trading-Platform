import { ApiProperty } from '@nestjs/swagger';
import { SystemIssueDto } from '../../../common/dto/system-issue.dto.js';
import { PaginationMetaDto } from '../../../common/pagination/pagination.dto.js';
import {
  CorporateActionDto,
  InstrumentDto,
} from './instrument-response.dto.js';
import { InstrumentCoverageRowDto } from './instrument-coverage.dto.js';

export class InstrumentListResponseDto {
  @ApiProperty({ type: [InstrumentDto] })
  items!: InstrumentDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}

export class CorporateActionListResponseDto {
  @ApiProperty({ type: [CorporateActionDto] })
  items!: CorporateActionDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}

export class InstrumentCoverageListResponseDto {
  @ApiProperty({ type: [InstrumentCoverageRowDto] })
  items!: InstrumentCoverageRowDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}

export class InstrumentIssueListResponseDto {
  @ApiProperty({ type: [SystemIssueDto] })
  items!: SystemIssueDto[];

  @ApiProperty({ type: PaginationMetaDto })
  page!: PaginationMetaDto;
}
