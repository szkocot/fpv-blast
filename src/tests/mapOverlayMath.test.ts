import { describe, expect, it } from 'vitest';
import {
  buildViewportGrid,
  coordinateKey,
  densityForZoom,
  sampleCapForDensity,
  thinArrows,
} from '../lib/services/mapOverlayMath';

describe('densityForZoom', () => {
  it('returns coarse for low zoom', () => {
    expect(densityForZoom(5)).toBe('coarse');
  });

  it('returns medium for mid zoom', () => {
    expect(densityForZoom(8)).toBe('medium');
  });

  it('returns fine for high zoom', () => {
    expect(densityForZoom(9)).toBe('fine');
  });

  it('keeps zoom 6 as medium so city-level maps are not undersampled', () => {
    expect(densityForZoom(6)).toBe('medium');
  });
});

describe('buildViewportGrid', () => {
  it('caps sample count for a large viewport', () => {
    const points = buildViewportGrid({ north: 54, south: 49, east: 24, west: 14 }, 'coarse');
    expect(points.length).toBeLessThanOrEqual(sampleCapForDensity('coarse'));
  });

  it('rounds coordinates so nearby cells share a cache key', () => {
    const a = coordinateKey(50.061234, 19.938765, 'fine');
    const b = coordinateKey(50.061299, 19.938701, 'fine');
    expect(a).toBe(b);
  });

  it('places interior samples for medium city-sized viewports', () => {
    const points = buildViewportGrid({ north: 50.633, south: 49.952, east: 19.325, west: 18.555 }, 'medium');

    expect(points.length).toBeGreaterThan(6);
    expect(points.some((point) => point.lat > 50 && point.lat < 50.6 && point.lon > 18.6 && point.lon < 19.3)).toBe(true);
  });
});

describe('thinArrows', () => {
  it('keeps fewer arrows at coarse density', () => {
    const arrows = Array.from({ length: 12 }, (_, i) => ({ lat: 50 + i * 0.01, lon: 20 + i * 0.01 }));
    const kept = thinArrows(arrows, 'coarse');
    expect(kept.length).toBeLessThan(arrows.length);
  });
});
