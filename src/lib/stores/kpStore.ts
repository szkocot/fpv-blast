// src/lib/stores/kpStore.ts
import { writable } from 'svelte/store';
import type { KpData } from '../types';
import { fetchKpForecast } from '../services/kpService';

export const kpStore = writable<KpData | null>(null);

export async function fetchKp(): Promise<void> {
  try {
    kpStore.set(await fetchKpForecast());
  } catch {
    kpStore.set(null);
  }
}
