import { describe, it, expect } from 'vitest';
import { parseKpResponse } from '../lib/services/kpService';

describe('parseKpResponse', () => {
  const validResponse = [
    ['time_tag', 'kp', 'observed', 'noaa_scale'],
    ['2026-03-25 00:00:00', '1.33', 'observed', ''],
    ['2026-03-25 03:00:00', '2.67', 'predicted', ''],
    ['2026-03-25 06:00:00', '5.00', 'predicted', 'G1'],
  ];

  it('skips the header row', () => {
    expect(parseKpResponse(validResponse)).toHaveLength(3);
  });

  it('parses time strings to Date objects', () => {
    const result = parseKpResponse(validResponse);
    expect(result[0].time).toBeInstanceOf(Date);
    expect(result[0].time.getUTCFullYear()).toBe(2026);
  });

  it('parses kp strings to numbers', () => {
    const result = parseKpResponse(validResponse);
    expect(result[0].kp).toBeCloseTo(1.33);
    expect(result[2].kp).toBeCloseTo(5.0);
  });

  it('returns empty array for empty input', () => {
    expect(parseKpResponse([])).toEqual([]);
  });

  it('filters out rows with NaN kp', () => {
    const bad = [
      ['time_tag', 'kp', 'observed', 'noaa_scale'],
      ['2026-03-25 00:00:00', 'bad', 'observed', ''],
      ['2026-03-25 03:00:00', '2.00', 'observed', ''],
    ];
    expect(parseKpResponse(bad)).toHaveLength(1);
  });
});
