import type { KpEntry } from '../types';

const NOAA_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';

interface KpObjectRow {
  time_tag?: unknown;
  kp?: unknown;
  observed?: unknown;
  noaa_scale?: unknown;
}

type KpRawRow = string[] | KpObjectRow;

function parseTimeTag(rawTimeTag: unknown): Date {
  const value = String(rawTimeTag ?? '');
  const isoLike = value.includes('T') ? value : value.replace(' ', 'T');
  const timestamp = /(?:Z|[+-]\d\d:\d\d)$/.test(isoLike) ? isoLike : `${isoLike}Z`;
  return new Date(timestamp);
}

function parseKpRow(row: KpRawRow): KpEntry {
  const [timeTag, kp] = Array.isArray(row)
    ? row
    : [row.time_tag, row.kp];

  return {
    time: parseTimeTag(timeTag),
    kp: Number.parseFloat(String(kp)),
  };
}

// Exported for testing — accepts both historical array rows and current NOAA object rows.
export function parseKpResponse(rows: KpRawRow[]): KpEntry[] {
  const dataRows = Array.isArray(rows[0]) ? rows.slice(1) : rows;

  return rows
    ? dataRows
        .map(parseKpRow)
        .filter((entry) => Number.isFinite(entry.kp) && !Number.isNaN(entry.time.getTime()))
    : [];
}

export async function fetchKpForecast(): Promise<KpEntry[]> {
  const res = await fetch(NOAA_URL);
  if (!res.ok) throw new Error(`Kp fetch failed: HTTP ${res.status}`);
  return parseKpResponse(await res.json());
}
