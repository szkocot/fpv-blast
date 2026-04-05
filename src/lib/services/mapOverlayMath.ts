import type { ForecastLocation, OverlayDensity } from '../types';

export interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface ViewportPoint extends ForecastLocation {
  key: string;
}

const DENSITY_CONFIG: Record<OverlayDensity, {
  baseStepDeg: number;
  cap: number;
  arrowStride: number;
  precision: number;
}> = {
  coarse: { baseStepDeg: 0.5, cap: 64, arrowStride: 6, precision: 2 },
  medium: { baseStepDeg: 0.2, cap: 196, arrowStride: 4, precision: 3 },
  fine:   { baseStepDeg: 0.08, cap: 400, arrowStride: 2, precision: 3 },
};

export function densityForZoom(zoom: number): OverlayDensity {
  if (zoom >= 9) return 'fine';
  if (zoom >= 6) return 'medium';
  return 'coarse';
}

export function gridStepForDensity(density: OverlayDensity): number {
  return DENSITY_CONFIG[density].baseStepDeg;
}

export function sampleCapForDensity(density: OverlayDensity): number {
  return DENSITY_CONFIG[density].cap;
}

export function arrowStrideForDensity(density: OverlayDensity): number {
  return DENSITY_CONFIG[density].arrowStride;
}

export function roundOverlayCoordinate(value: number, density: OverlayDensity): number {
  return Number(value.toFixed(DENSITY_CONFIG[density].precision));
}

export function coordinateKey(lat: number, lon: number, density: OverlayDensity): string {
  return `${roundOverlayCoordinate(lat, density)}:${roundOverlayCoordinate(lon, density)}`;
}

export function buildViewportGrid(bounds: ViewportBounds, density: OverlayDensity): ViewportPoint[] {
  const step = gridStepForDensity(density);
  const latSpan = Math.max(bounds.north - bounds.south, 0);
  const lonSpan = Math.max(bounds.east - bounds.west, 0);
  const midLat = (bounds.north + bounds.south) / 2;
  const lonScale = Math.max(Math.cos(midLat * Math.PI / 180), 0.25);
  const lonStep = step / lonScale;

  const rows = Math.max(1, Math.ceil(latSpan / step) + 1);
  const cols = Math.max(1, Math.ceil(lonSpan / lonStep) + 1);
  const rawPoints: ViewportPoint[] = [];

  for (let row = 0; row < rows; row++) {
    const lat = bounds.south + (rows === 1 ? 0 : (latSpan * row) / (rows - 1));
    for (let col = 0; col < cols; col++) {
      const lon = bounds.west + (cols === 1 ? 0 : (lonSpan * col) / (cols - 1));
      const roundedLat = roundOverlayCoordinate(lat, density);
      const roundedLon = roundOverlayCoordinate(lon, density);
      rawPoints.push({
        lat: roundedLat,
        lon: roundedLon,
        name: coordinateKey(roundedLat, roundedLon, density),
        key: coordinateKey(roundedLat, roundedLon, density),
      });
    }
  }

  return capSamples(rawPoints, sampleCapForDensity(density));
}

export function thinArrows<T extends { lat: number; lon: number }>(samples: T[], density: OverlayDensity): T[] {
  const stride = arrowStrideForDensity(density);
  if (samples.length <= 1 || stride <= 1) return samples;
  const thinned = samples.filter((_, index) => index % stride === 0);
  return thinned.length > 0 ? thinned : samples.slice(0, 1);
}

function capSamples<T>(samples: T[], cap: number): T[] {
  if (samples.length <= cap) return samples;
  const stride = Math.ceil(samples.length / cap);
  return samples.filter((_, index) => index % stride === 0).slice(0, cap);
}
