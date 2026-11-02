import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FetchInstrumentsDto } from './r2-data.dto.js';

describe('FetchInstrumentsDto', () => {
  it('accepts the UUIDv7 ids the application generates', async () => {
    const dto = plainToInstance(FetchInstrumentsDto, {
      instrumentIds: ['01a19d67-a52f-7cd9-b39b-0c60dc7330a7'],
      mode: 'missing_only',
      dryRun: false,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('still rejects values that are not UUIDs', async () => {
    const dto = plainToInstance(FetchInstrumentsDto, {
      instrumentIds: ['not-a-uuid'],
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('instrumentIds');
  });
});
