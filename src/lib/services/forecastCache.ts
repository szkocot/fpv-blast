import type { WindGrid } from '../types';

const CACHE_KEY = 'fpv-blast-forecast-cache';
const TTL_MS = 60 * 60 * 1000; // 1 hour
const PROXIMITY_KM = 5;

interface StoredEntry {
  windGrid: Omit<WindGrid, 'times'> & { times: string[] };
  timestamp: number;
  lat: number;
  lon: number;
  modelCount: number;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function read(lat: number, lon: number): { windGrid: WindGrid; modelCount: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: StoredEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp >= TTL_MS) return null;
    if (distanceKm(entry.lat, entry.lon, lat, lon) >= PROXIMITY_KM) return null;
    return {
      windGrid: { ...entry.windGrid, times: entry.windGrid.times.map(s => new Date(s)) },
      modelCount: entry.modelCount,
    };
  } catch {
    return null;
  }
}

export function write(lat: number, lon: number, windGrid: WindGrid, modelCount: number): void {
  try {
    const entry: StoredEntry = {
      windGrid: { ...windGrid, times: windGrid.times.map(d => d.toISOString()) },
      timestamp: Date.now(),
      lat,
      lon,
      modelCount,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // QuotaExceededError or unavailable localStorage — degrade gracefully
  }
}
