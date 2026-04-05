import type { OverlayDensity, OverlaySample } from '../types';
import {
  buildViewportGrid,
  coordinateKey,
  densityForZoom,
  gridStepForDensity,
  type ViewportBounds,
} from './mapOverlayMath';
import {
  buildOverlayUrl,
  decodeOverlayResponse,
  interpolateOverlay20m,
  WeatherApiRateLimitError,
} from './openMeteo';
import { readNearbyOverlaySample, readOverlaySample, writeOverlaySample } from './forecastCache';

export interface OverlayBounds extends ViewportBounds {}

export interface OverlayPoint {
  lat: number;
  lon: number;
}

export interface MapOverlayServiceDeps {
  buildViewportGrid?: typeof buildViewportGrid;
  readOverlaySample?: typeof readOverlaySample;
  writeOverlaySample?: typeof writeOverlaySample;
  fetchOverlaySample?: (
    point: OverlayPoint,
    hourIndex: number,
    density: OverlayDensity,
  ) => Promise<OverlaySample>;
  fetchFn?: typeof fetch;
  now?: () => number;
}

export interface LoadViewportOverlayArgs {
  bounds: OverlayBounds;
  zoom: number;
  hourIndex: number;
}

function sampleKey(point: OverlayPoint, hourIndex: number): string {
  return `overlay:v2:20m:${hourIndex}:${coordinateKey(point.lat, point.lon, 'fine')}`;
}

async function fetchOverlaySample(
  fetchFn: typeof fetch,
  point: OverlayPoint,
  hourIndex: number,
  now: () => number,
): Promise<OverlaySample> {
  const response = await fetchFn(buildOverlayUrl(point.lat, point.lon, 'best_match'));
  if (!response.ok) {
    if (response.status === 429) {
      throw new WeatherApiRateLimitError();
    }
    throw new Error(`HTTP ${response.status}`);
  }

  const data = interpolateOverlay20m(decodeOverlayResponse(await response.json()));
  const safeHourIndex = Math.max(0, Math.min(hourIndex, data.speedAt20m.length - 1));

  return {
    lat: point.lat,
    lon: point.lon,
    speedKmh: data.speedAt20m[safeHourIndex] ?? 0,
    directionDeg: data.directionAt20m[safeHourIndex] ?? 0,
    fetchedAt: now(),
  };
}

export function createMapOverlayService(deps: MapOverlayServiceDeps = {}) {
  const buildGrid = deps.buildViewportGrid ?? buildViewportGrid;
  const readSample = deps.readOverlaySample ?? readOverlaySample;
  const writeSample = deps.writeOverlaySample ?? writeOverlaySample;
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? (() => Date.now());
  const fetchSample = deps.fetchOverlaySample
    ?? ((point: OverlayPoint, hourIndex: number) => fetchOverlaySample(fetchFn, point, hourIndex, now));

  return {
    async loadViewportOverlay(args: LoadViewportOverlayArgs): Promise<OverlaySample[]> {
      const density = densityForZoom(args.zoom);
      const points = buildGrid(args.bounds, density);
      const resolved: Array<OverlaySample | null> = new Array(points.length).fill(null);
      const missing: Array<{ index: number; point: OverlayPoint; key: string }> = [];
      let sawRateLimit = false;

      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        const key = sampleKey(point, args.hourIndex);
        const cached = readSample(key) ?? readNearbyOverlaySample({
          hourIndex: args.hourIndex,
          lat: point.lat,
          lon: point.lon,
          maxDistanceDeg: gridStepForDensity(density) * 0.55,
        });
        if (cached) {
          resolved[index] = cached;
          continue;
        }
        missing.push({ index, point, key });
      }

      const fetched = await Promise.allSettled(
        missing.map(async ({ point }) => fetchSample(point, args.hourIndex, density))
      );

      fetched.forEach((result, fetchIndex) => {
        const target = missing[fetchIndex];
        if (!target) return;

        if (result.status === 'fulfilled') {
          resolved[target.index] = result.value;
          writeSample(target.key, result.value);
          return;
        }

      if (result.reason instanceof WeatherApiRateLimitError) {
        sawRateLimit = true;
      }
      });

      const samples = resolved.filter((sample): sample is OverlaySample => sample !== null);
      if (samples.length === 0 && sawRateLimit) {
        throw new WeatherApiRateLimitError();
      }

      return samples;
    },
    densityForZoom,
  };
}

export { densityForZoom } from './mapOverlayMath';
export type { OverlaySample } from '../types';
