<!-- src/lib/components/MapOverlayCanvas.svelte -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { OverlayDensity, OverlaySample as BaseOverlaySample } from '../types';

  interface OverlayBounds {
    north: number;
    south: number;
    east: number;
    west: number;
  }

  type CanvasOverlaySample = BaseOverlaySample & {
    weight?: number;
    x?: number;
    y?: number;
  };

  interface VectorPoint {
    x: number;
    y: number;
    speedKmh: number;
    directionDeg: number;
    vx: number;
    vy: number;
  }

  export let samples: CanvasOverlaySample[] = [];
  export let bounds: OverlayBounds | null = null;
  export let thresholdKmh = 0;
  export let density: OverlayDensity = 'medium';

  let host: HTMLDivElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let ctx: CanvasRenderingContext2D | null = null;
  let heatCanvas: HTMLCanvasElement | null = null;
  let heatCtx: CanvasRenderingContext2D | null = null;
  let resizeObserver: ResizeObserver | undefined;
  let rafId = 0;

  function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  function getPoint(sample: CanvasOverlaySample, width: number, height: number) {
    if (typeof sample.x === 'number' && typeof sample.y === 'number') {
      const normalized = sample.x >= 0 && sample.x <= 1 && sample.y >= 0 && sample.y <= 1;
      return {
        x: normalized ? sample.x * width : sample.x,
        y: normalized ? sample.y * height : sample.y,
      };
    }

    if (!bounds || typeof sample.lon !== 'number' || typeof sample.lat !== 'number') return null;

    const spanX = bounds.east - bounds.west;
    const spanY = bounds.north - bounds.south;
    if (!spanX || !spanY) return null;

    return {
      x: ((sample.lon - bounds.west) / spanX) * width,
      y: ((bounds.north - sample.lat) / spanY) * height,
    };
  }

  function renderArrow(x: number, y: number, directionDeg: number, speedKmh: number, alpha: number) {
    if (!ctx) return;

    const speedScale = clamp(speedKmh / Math.max(thresholdKmh || 1, 1), 0, 1.5);
    const length = 14 + speedScale * 10;
    const rad = (directionDeg * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const endX = x + dx * length;
    const endY = y + dy * length;
    const head = 5 + speedScale * 1.5;
    const tailInset = 4 + speedScale * 2;
    const startX = x - dx * tailInset;
    const startY = y - dy * tailInset;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(37, 57, 76, 0.78)';
    ctx.fillStyle = 'rgba(37, 57, 76, 0.78)';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.48)';
    ctx.shadowBlur = 2;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.lineWidth = 0.7;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.68)';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const angle = Math.atan2(endY - y, endX - x);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - Math.cos(angle - Math.PI / 6) * head, endY - Math.sin(angle - Math.PI / 6) * head);
    ctx.lineTo(endX - Math.cos(angle + Math.PI / 6) * head, endY - Math.sin(angle + Math.PI / 6) * head);
    ctx.closePath();
    ctx.fill();

    const barbSpacing = 4.5;
    const barbLength = 3.8 + speedScale * 1.6;
    const barbCount = Math.min(2, Math.floor(speedScale + 0.35));
    for (let index = 0; index < barbCount; index += 1) {
      const anchorX = endX - dx * (7 + index * barbSpacing);
      const anchorY = endY - dy * (7 + index * barbSpacing);
      const barbAngle = angle + Math.PI * 0.78;
      const barbX = anchorX + Math.cos(barbAngle) * barbLength;
      const barbY = anchorY + Math.sin(barbAngle) * barbLength;

      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(barbX, barbY);
      ctx.strokeStyle = 'rgba(37, 57, 76, 0.72)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    ctx.restore();
  }

  function colorForSpeed(speedKmh: number, minSpeed: number, maxSpeed: number) {
    const thresholdBase = Math.max(thresholdKmh || maxSpeed || 1, 1);
    const ratio = clamp(speedKmh / thresholdBase, 0, 1.8);
    const viewportRatio = clamp((speedKmh - minSpeed) / Math.max(maxSpeed - minSpeed, 1), 0, 1);
    const t = clamp(viewportRatio * 0.6 + Math.min(ratio, 1.1) * 0.4, 0, 1);

    if (ratio <= 0.72) {
      return {
        r: Math.round(86 + (111 - 86) * t),
        g: Math.round(153 + (193 - 153) * t),
        b: Math.round(211 + (182 - 211) * t),
        a: Math.round((0.16 + 0.18 * t) * 255),
      };
    }

    if (ratio <= 1) {
      const warm = clamp((t - 0.4) / 0.6, 0, 1);
      return {
        r: Math.round(183 + (227 - 183) * warm),
        g: Math.round(198 + (201 - 198) * warm),
        b: Math.round(126 + (109 - 126) * warm),
        a: Math.round((0.24 + 0.2 * warm) * 255),
      };
    }

    const hot = clamp((t - 0.55) / 0.45, 0, 1);
    return {
      r: Math.round(229 + (208 - 229) * hot),
      g: Math.round(167 + (97 - 167) * hot),
      b: Math.round(88 + (74 - 88) * hot),
      a: Math.round((0.34 + 0.22 * hot) * 255),
    };
  }

  function heatResolution(width: number, height: number) {
    const longestSide = Math.max(width, height);
    const target = density === 'fine' ? 96 : density === 'medium' ? 64 : 32;
    const scale = target / longestSide;
    return {
      width: Math.max(20, Math.round(width * scale)),
      height: Math.max(20, Math.round(height * scale)),
    };
  }

  function interpolateWind(points: VectorPoint[], x: number, y: number, influenceScale: number) {
    let totalWeight = 0;
    let sumSpeed = 0;
    let sumVx = 0;
    let sumVy = 0;

    for (const point of points) {
      const dx = x - point.x;
      const dy = y - point.y;
      const distance = Math.hypot(dx, dy);

      // Continuous inverse-distance weighting across the whole viewport.
      // This avoids "islands" around sampled points when zoomed in.
      const normalized = distance / Math.max(influenceScale, 1);
      const weight = 1 / (1 + normalized * normalized * normalized);
      totalWeight += weight;
      sumSpeed += point.speedKmh * weight;
      sumVx += point.vx * weight;
      sumVy += point.vy * weight;
    }

    if (totalWeight === 0) return null;

    const vx = sumVx / totalWeight;
    const vy = sumVy / totalWeight;
    const speedKmh = sumSpeed / totalWeight;
    const directionDeg = (Math.atan2(vx, -vy) * 180) / Math.PI;

    return {
      speedKmh,
      directionDeg: ((directionDeg % 360) + 360) % 360,
      strength: totalWeight,
    };
  }

  function drawHeatLayer(points: VectorPoint[], width: number, height: number, maxSpeed: number) {
    if (!ctx) return;

    if (!heatCanvas) {
      heatCanvas = document.createElement('canvas');
      heatCtx = heatCanvas.getContext('2d');
    }
    if (!heatCtx || !heatCanvas) return;

    const resolution = heatResolution(width, height);
    if (heatCanvas.width !== resolution.width || heatCanvas.height !== resolution.height) {
      heatCanvas.width = resolution.width;
      heatCanvas.height = resolution.height;
    }

    const influenceScale = Math.max(width, height) / (density === 'fine' ? 3.8 : density === 'medium' ? 3.2 : 2.5);
    const minSpeed = points.reduce((min, point) => Math.min(min, point.speedKmh), Number.POSITIVE_INFINITY);
    const image = heatCtx.createImageData(resolution.width, resolution.height);
    const data = image.data;
    const sampleWidth = width / resolution.width;
    const sampleHeight = height / resolution.height;

    for (let y = 0; y < resolution.height; y += 1) {
      const sampleY = (y + 0.5) * sampleHeight;
      for (let x = 0; x < resolution.width; x += 1) {
        const sampleX = (x + 0.5) * sampleWidth;
        const wind = interpolateWind(points, sampleX, sampleY, influenceScale);
        if (!wind) continue;

        const color = colorForSpeed(wind.speedKmh, minSpeed, maxSpeed);
        const offset = (y * resolution.width + x) * 4;
        data[offset] = color.r;
        data[offset + 1] = color.g;
        data[offset + 2] = color.b;
        data[offset + 3] = color.a;
      }
    }

    heatCtx.putImageData(image, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
    ctx.drawImage(heatCanvas, 0, 0, width, height);
    ctx.restore();
  }

  function drawVectorField(points: VectorPoint[], width: number, height: number) {
    const spacing = density === 'fine' ? 44 : density === 'medium' ? 58 : 72;
    const influenceScale = spacing * (density === 'fine' ? 2.3 : 2.6);

    for (let y = spacing * 0.65; y < height; y += spacing) {
      for (let x = spacing * 0.65; x < width; x += spacing) {
        const wind = interpolateWind(points, x, y, influenceScale);
        if (!wind) continue;
        if (wind.speedKmh < 1.5) continue;

        renderArrow(x, y, wind.directionDeg, wind.speedKmh, 0.72);
      }
    }
  }

  function render() {
    if (!ctx || !canvas) return;
    const context = ctx;

    if (!host || !canvas) return;

    const rect = host.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'source-over';

    if (!samples.length) return;

    const maxSpeed = samples.reduce((max, sample) => Math.max(max, sample.speedKmh), 0) || 1;
    const points: VectorPoint[] = samples.flatMap((sample) => {
      const point = getPoint(sample, width, height);
      if (!point) return [];

      const rad = (sample.directionDeg * Math.PI) / 180;
      return [{
        ...point,
        speedKmh: sample.speedKmh,
        directionDeg: sample.directionDeg,
        vx: Math.sin(rad) * sample.speedKmh,
        vy: -Math.cos(rad) * sample.speedKmh,
      }];
    });

    drawHeatLayer(points, width, height, maxSpeed);
    drawVectorField(points, width, height);
  }

  function queueRender() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(render);
  }

  onMount(() => {
    if (!canvas || !host) return;

    ctx = canvas.getContext('2d');
    queueRender();

    resizeObserver = new ResizeObserver(queueRender);
    resizeObserver.observe(host);

    return () => {
      resizeObserver?.disconnect();
      resizeObserver = undefined;
    };
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });

  $: {
    samples;
    bounds;
    thresholdKmh;
    density;

    if (ctx) queueRender();
  }
</script>

<div class="overlay" bind:this={host} aria-hidden="true">
    <canvas bind:this={canvas} class="overlay-canvas"></canvas>
  </div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 12;
  }

  .overlay-canvas {
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: none;
  }
</style>
