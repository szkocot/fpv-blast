import { readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

function compiledCss(path: string): string {
  const source = readFileSync(path, 'utf8');
  return compile(source, { filename: path }).css?.code ?? '';
}

describe('mobile layout regressions', () => {
  it('pads the app shell for iPhone PWA safe areas in all app states', () => {
    const css = compiledCss('/Users/szymonkocot/Projects/fpv-blast/src/App.svelte');

    expect(css).toMatch(/padding-top:\s*var\(--safe-top\)/);
    expect(css).not.toMatch(/\.app-shell(?:\.[\w-]+)?\s*\{[^}]*padding-bottom:\s*var\(--safe-bottom\)/s);
    expect(css).toMatch(/\.full-screen-msg(?:\.[\w-]+)?\s*\{[^}]*padding-bottom:\s*calc\(32px \+ var\(--safe-bottom\)\)/s);
    expect(css).toMatch(/height:\s*100dvh/);
  });

  it('keeps the weather strip readable on narrow screens', () => {
    const css = compiledCss('/Users/szymonkocot/Projects/fpv-blast/src/lib/components/WeatherStrip.svelte');

    expect(css).toMatch(/overflow-x:\s*auto/);
    expect(css).toMatch(/flex:\s*0 0 34px/);
  });

  it('lets the heatmap scroll horizontally when the content is wider than the viewport', () => {
    const source = readFileSync('/Users/szymonkocot/Projects/fpv-blast/src/lib/components/HeatmapCanvas.svelte', 'utf8');
    const css = compiledCss('/Users/szymonkocot/Projects/fpv-blast/src/lib/components/HeatmapCanvas.svelte');

    expect(source).toContain('class="heatmap-scroll"');
    expect(source).toContain('style:width={`${contentWidth}px`}');
    expect(css).toMatch(/overflow-x:\s*auto/);
    expect(css).toMatch(/min-width:\s*100%/);
  });

  it('keeps the mobile screen fixed-height and gives the heatmap the flexible space', () => {
    const css = readFileSync('/Users/szymonkocot/Projects/fpv-blast/src/app.css', 'utf8');

    expect(css).toMatch(/\.main-column\s*\{[^}]*overflow-y:\s*hidden/s);
    expect(css).toMatch(/\.chart-area\s*\{[^}]*flex:\s*1/s);
    expect(css).toMatch(/\.chart-area\s*\{[^}]*min-height:\s*0/s);
  });

  it('pads the location picker controls away from iPhone notch and home indicator', () => {
    const css = compiledCss('/Users/szymonkocot/Projects/fpv-blast/src/lib/components/LocationPicker.svelte');

    expect(css).toMatch(/padding:\s*calc\(10px \+ var\(--safe-top\)\)\s+12px\s+10px/);
    expect(css).toMatch(/padding:\s*12px\s+16px\s+calc\(12px \+ var\(--safe-bottom\)\)/);
  });
});
