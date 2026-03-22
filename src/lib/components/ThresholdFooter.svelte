<!-- src/lib/components/ThresholdFooter.svelte -->
<script lang="ts">
  import { convertFromKmh } from '../stores/settingsStore';
  import type { WindUnit } from '../types';
  export let thresholdKmh: number;
  export let unit: WindUnit;
  export let onSettings: () => void;

  $: displayVal = convertFromKmh(thresholdKmh, unit).toFixed(0);
  $: unitLabel  = unit === 'kmh' ? 'km/h' : unit === 'ms' ? 'm/s' : 'kn';
</script>

<footer>
  <div class="threshold">
    <span class="label">Threshold</span>
    <span class="value">{displayVal} {unitLabel}</span>
  </div>
  <div class="legend">
    <span class="dot" style="background: var(--green)"></span><span class="leg-text">OK</span>
    <span class="dot" style="background: var(--yellow)"></span><span class="leg-text">±20%</span>
    <span class="dot" style="background: var(--red)"></span><span class="leg-text">No-fly</span>
  </div>
  <button class="gear" on:click={onSettings} aria-label="Settings">⚙</button>
</footer>

<style>
  footer {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    background: var(--surface2);
  }
  .threshold { display: flex; gap: 6px; align-items: baseline; }
  .label  { font-size: 10px; color: var(--text-muted); }
  .value  { font-size: 13px; font-weight: 700; color: var(--text); }
  .legend { display: flex; align-items: center; gap: 4px; margin-left: auto; }
  .dot    { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
  .leg-text { font-size: 9px; color: var(--text-muted); margin-right: 4px; }
  .gear   { font-size: 18px; background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 0 0 0 4px; }
</style>
