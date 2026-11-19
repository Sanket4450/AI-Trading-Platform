import { BadRequestException, Injectable } from '@nestjs/common';
import { importCorporateActions, recordAudit } from '@ai-trading/database';
import type { RequestMeta } from '../../common/http/request-meta.js';
import type {
  CorporateActionImportDto,
  CorporateActionRowDto,
} from './dto/instrument-coverage-query.dto.js';

@Injectable()
export class InstrumentReferenceService {
  async importActions(
    body: CorporateActionImportDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const rows = body.rows?.length ? body.rows : this.parseCsv(body.csv ?? '');
    if (rows.length === 0)
      throw new BadRequestException('No corporate-action rows were supplied');
    if (rows.length > 5000)
      throw new BadRequestException('At most 5,000 rows are allowed');
    const result = await importCorporateActions({
      rows: rows.map((row) => ({
        isin: row.isin ?? null,
        symbol: row.symbol ?? null,
        exDate: row.exDate,
        actionType: row.actionType,
        ratioNumerator: row.ratioNumerator ?? null,
        ratioDenominator: row.ratioDenominator ?? null,
        dividendPerShare: row.dividendPerShare ?? null,
        priceFactor: row.priceFactor ?? null,
        volumeFactor: row.volumeFactor ?? null,
        source: row.source,
        notes: row.notes ?? null,
        status: row.status,
      })),
      defaultSource: body.source ?? 'reviewed-csv',
      dryRun: body.dryRun === true,
    });
    if (body.dryRun !== true) {
      await recordAudit({
        actorUserId,
        accountId: null,
        action: 'data.corporate_actions_imported',
        entityType: 'corporate_action',
        entityId: null,
        beforeState: null,
        afterState: {
          imported: result.imported,
          updated: result.updated,
          rows: result.results.length,
          source: body.source ?? 'reviewed-csv',
        },
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }
    return result;
  }

  private parseCsv(csv: string): CorporateActionRowDto[] {
    const lines = csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];
    const headers = this.splitCsvLine(lines[0]!).map((header) => header.trim());
    return lines.slice(1).map((line) => {
      const values = this.splitCsvLine(line);
      const record = new Map<string, string>();
      headers.forEach((header, index) =>
        record.set(header, values[index]?.trim() ?? ''),
      );
      return {
        isin: record.get('isin') || undefined,
        symbol: record.get('symbol') || undefined,
        exDate: record.get('ex_date') ?? '',
        actionType: record.get('action_type') ?? '',
        ratioNumerator: record.get('ratio_numerator') || undefined,
        ratioDenominator: record.get('ratio_denominator') || undefined,
        dividendPerShare: record.get('dividend_per_share') || undefined,
        priceFactor: record.get('price_factor') || undefined,
        volumeFactor: record.get('volume_factor') || undefined,
        source: record.get('source') || undefined,
        notes: record.get('notes') || undefined,
        status:
          (record.get('status') as 'announced' | 'confirmed' | undefined) ||
          undefined,
      };
    });
  }

  private splitCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index]!;
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === ',' && !quoted) {
        values.push(current);
        current = '';
      } else {
        current += character;
      }
    }
    values.push(current);
    return values;
  }
}
