import { describe, expect, it } from 'vitest';
import { formatAction, formatSettingKey, humanize, label } from './labels';

describe('labels', () => {
  it('turns codes into words without leaking separators', () => {
    expect(humanize('partial_reconciled')).toBe('Partial reconciled');
    expect(humanize('historical_backfill')).toBe('Historical backfill');
    expect(humanize('invalid_ohlc')).toBe('Invalid OHLC');
    expect(humanize('session_open')).toBe('Session open');
  });

  it('prefers explicit operator labels over generated words', () => {
    expect(label('partial_mismatch')).toBe('Gaps · mismatch');
    expect(label('api_key')).toBe('API key');
    expect(label('NSE_EQ')).toBe('NSE equity');
    expect(label('not_applicable')).toBe('Not applicable');
  });

  it('falls back for missing values', () => {
    expect(label(null)).toBe('—');
    expect(label('', 'Unknown')).toBe('Unknown');
  });

  it('sentence-cases audit actions', () => {
    expect(formatAction('configuration.created')).toBe('Configuration created');
    expect(formatAction('strategy.version.created')).toBe('Strategy version created');
  });

  it('names namespaced settings', () => {
    expect(formatSettingKey('data.quality.max_gap_minutes')).toBe('Maximum gap (minutes)');
    expect(formatSettingKey('custom.setting_name')).toBe('Setting name');
  });
});
