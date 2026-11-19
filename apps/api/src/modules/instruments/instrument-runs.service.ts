import { Injectable, NotFoundException } from '@nestjs/common';
import { getIngestionRunDetail } from '@ai-trading/database';

@Injectable()
export class InstrumentRunsService {
  async detail(id: string) {
    const detail = await getIngestionRunDetail(id);
    if (!detail) throw new NotFoundException('Ingestion run not found');
    return detail;
  }
}
