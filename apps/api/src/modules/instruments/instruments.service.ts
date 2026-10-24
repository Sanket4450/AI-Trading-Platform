import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  getInstrument,
  listCandles,
  listCorporateActions,
  listInstrumentMappings,
  listInstruments,
} from '@ai-trading/database';
import type { ListInstrumentsDto } from './dto/list-instruments.dto.js';

@Injectable()
export class InstrumentsService {
  list(query: ListInstrumentsDto) {
    return listInstruments({
      search: query.search,
      segment: query.segment,
      activeOnly: query.active === undefined ? true : query.active === 'true',
      limit: query.limit,
    });
  }

  async detail(id: string) {
    const instrument = await getInstrument(id);
    if (!instrument) throw new NotFoundException('Instrument not found');
    return instrument;
  }

  async mappings(id: string) {
    await this.detail(id);
    return listInstrumentMappings(id);
  }

  async corporateActions(id: string) {
    await this.detail(id);
    return listCorporateActions(id);
  }

  async candles(id: string, from?: string, to?: string) {
    await this.detail(id);
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 5 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('from and to must be valid ISO timestamps');
    }
    if (fromDate >= toDate) {
      throw new BadRequestException('from must be earlier than to');
    }
    return listCandles({ instrumentId: id, from: fromDate, to: toDate });
  }
}
