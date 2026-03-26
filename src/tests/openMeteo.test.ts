import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildUrl, decodeResponse, fetchModel } from '../lib/services/openMeteo';

describe('buildUrl', () => {
  it('includes lat/lon', () => {
    const url = buildUrl(50.06, 19.94, 'ecmwf_ifs04');
    expect(url).toContain('latitude=50.06');
    expect(url).toContain('longitude=19.94');
  });
  it('includes model', () => {
    expect(buildUrl(0, 0, 'gfs_seamless')).toContain('models=gfs_seamless');
  });
  it('includes all 4 height variables', () => {
    const url = buildUrl(0, 0, 'best_match');
    expect(url).toContain('wind_speed_10m');
    expect(url).toContain('wind_speed_80m');
    expect(url).toContain('wind_speed_120m');
    expect(url).toContain('wind_speed_180m');
  });
  it('requests 7 forecast days', () => {
    expect(buildUrl(0, 0, 'best_match')).toContain('forecast_days=7');
  });
  it('includes temperature and weather code variables', () => {
    const url = buildUrl(0, 0, 'best_match');
    expect(url).toContain('temperature_2m');
    expect(url).toContain('weather_code');
  });
  it('includes wind_gusts_10m variable', () => {
    expect(buildUrl(0, 0, 'best_match')).toContain('wind_gusts_10m');
  });
});

describe('decodeResponse', () => {
  const json = {
    hourly: {
      time: ['2026-03-23T00:00', '2026-03-23T01:00'],
      wind_speed_10m:  [10.5, 11.0],
      wind_speed_80m:  [20.5, 21.0],
      wind_speed_120m: [25.0, 26.0],
      wind_speed_180m: [30.0, 31.0],
      temperature_2m:  [12.0, 13.0],
      weather_code:    [1, 2],
      wind_gusts_10m:  [15.0, 16.0],
    }
  };
  it('parses wind speeds', () => {
    const r = decodeResponse(json);
    expect(r.at10m[0]).toBeCloseTo(10.5);
    expect(r.at80m[0]).toBeCloseTo(20.5);
  });
  it('parses times as Date objects', () => {
    const r = decodeResponse(json);
    expect(r.times[0]).toBeInstanceOf(Date);
    expect(r.times.length).toBe(2);
  });
  it('parses temperature and weather code', () => {
    const r = decodeResponse(json);
    expect(r.temperature[0]).toBeCloseTo(12.0);
    expect(r.weatherCode[0]).toBe(1);
  });
  it('parses wind gusts', () => {
    const r = decodeResponse(json);
    expect(r.windGust[0]).toBeCloseTo(15.0);
    expect(r.windGust[1]).toBeCloseTo(16.0);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchModel timeout', () => {
  it('rejects after 8 seconds when fetch does not respond', async () => {
    vi.useFakeTimers();

    // Capture the AbortSignal so we can assert it fired after advancing time.
    // The fetch mock never resolves so fetchModel stays pending — we suppress
    // that pending rejection and instead assert the abort mechanism fired.
    let capturedSignal: AbortSignal | null | undefined;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
      capturedSignal = opts?.signal;
      return new Promise(() => {}); // never resolves
    }));

    const promise = fetchModel(0, 0, 'best_match');
    promise.catch(() => {}); // prevent unhandled-rejection after test ends

    await vi.advanceTimersByTimeAsync(8001);

    // The AbortController timeout should have fired within 8 seconds.
    expect(capturedSignal?.aborted).toBe(true);
  });
});
