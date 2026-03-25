import type { KpEntry } from '../types';

const NOAA_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';

// Exported for testing — accepts the raw parsed JSON array
export function parseKpResponse(rows: string[][]): KpEntry[] {
  return rows
    .slice(1)  // skip header row
    .map(([timeTag, kp]) => ({
      time: new Date(timeTag.replace(' ', 'T') + 'Z'),
      kp:   parseFloat(kp),
    }))
    .filter(e => !isNaN(e.kp));
}

export async function fetchKpForecast(): Promise<KpEntry[]> {
  const res = await fetch(NOAA_URL);
  if (!res.ok) throw new Error(`Kp fetch failed: HTTP ${res.status}`);
  return parseKpResponse(await res.json());
}
