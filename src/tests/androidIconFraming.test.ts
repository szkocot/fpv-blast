import { describe, expect, it } from 'vitest';
import {
  ANDROID_LAUNCHER_INSET,
  ANDROID_SPLASH_INSET,
} from '../../scripts/icon-artwork.mjs';

describe('android icon framing', () => {
  it('uses extra inset for launcher icons so adaptive masks do not clip the logo', () => {
    expect(ANDROID_LAUNCHER_INSET).toBeGreaterThan(0.12);
    expect(ANDROID_LAUNCHER_INSET).toBeLessThan(0.25);
  });

  it('uses even more inset for splash screens than launcher icons', () => {
    expect(ANDROID_SPLASH_INSET).toBeGreaterThan(ANDROID_LAUNCHER_INSET);
    expect(ANDROID_SPLASH_INSET).toBeLessThan(0.35);
  });
});
