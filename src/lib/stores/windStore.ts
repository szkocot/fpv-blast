// src/lib/stores/windStore.ts
import { writable, get } from 'svelte/store';
import type { WindGrid, FetchState } from '../types';
import { MODELS } from '../types';
import { fetchModel } from '../services/openMeteo';
import { buildGrid } from '../services/windProcessor';

export const windGrid    = writable<WindGrid | null>(null);
export const fetchState  = writable<FetchState>({ type: 'idle' });
export const hourOffset  = writable<number>(0);
export const locationName = writable<string>('');

let lastFetchLat: number | null = null;
let lastFetchLon: number | null = null;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export async function fetchWind(lat: number, lon: number): Promise<void> {
  // 5km guard
  if (lastFetchLat !== null && lastFetchLon !== null) {
    if (distanceKm(lastFetchLat, lastFetchLon, lat, lon) < 5 && get(windGrid) !== null) return;
  }

  fetchState.set({ type: 'loading' });
  lastFetchLat = lat;
  lastFetchLon = lon;

  const results = await Promise.allSettled(
    MODELS.map(model => fetchModel(lat, lon, model))
  );

  const succeeded = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchModel>>> => r.status === 'fulfilled')
    .map(r => r.value);

  if (succeeded.length < 2) {
    fetchState.set({ type: 'failed', message: 'Could not load forecast — check your connection.' });
    return;
  }

  const times = succeeded[0].times;
  const grid = buildGrid(succeeded, times);
  windGrid.set(grid);
  fetchState.set({ type: 'loaded', modelCount: succeeded.length });
}
