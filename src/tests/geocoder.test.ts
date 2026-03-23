import { describe, it, expect, vi, afterEach } from 'vitest';
import { forwardGeocode } from '../lib/services/geocoder';

afterEach(() => vi.restoreAllMocks());

describe('forwardGeocode', () => {
  it('returns mapped results on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { display_name: 'Warsaw, Masovian Voivodeship, Poland', lat: '52.23', lon: '21.01' },
        { display_name: 'Warsaw, Indiana, United States', lat: '41.23', lon: '-85.85' },
      ],
    }));
    const results = await forwardGeocode('Warsaw');
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('Warsaw, Masovian Voivodeship');
    expect(results[0].lat).toBeCloseTo(52.23);
    expect(results[0].lon).toBeCloseTo(21.01);
  });

  it('returns [] on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const results = await forwardGeocode('nowhere');
    expect(results).toEqual([]);
  });

  it('returns [] on network throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const results = await forwardGeocode('nowhere');
    expect(results).toEqual([]);
  });
});
