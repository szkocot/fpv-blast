<!-- src/lib/components/ErrorBanner.svelte -->
<script lang="ts">
  export let message: string;
  export let style: 'warning' | 'error' = 'warning';
  export let onRetry: (() => void) | null = null;
</script>

<div class="banner {style}">
  <span class="icon">{style === 'error' ? '✗' : '⚠'}</span>
  <span class="msg">{message}</span>
  {#if onRetry}
    <button on:click={onRetry}>Retry</button>
  {/if}
</div>

<style>
  .banner {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px;
    font-size: 12px;
  }
  .warning { background: rgba(255,208,50,0.1); border-bottom: 1px solid rgba(255,208,50,0.2); }
  .error   { background: rgba(255,60,60,0.1);  border-bottom: 1px solid rgba(255,60,60,0.2); }
  .icon    { flex-shrink: 0; }
  .msg     { flex: 1; color: var(--text); }
  button   { font-size: 12px; font-weight: 600; color: var(--blue); background: none; border: none; cursor: pointer; }
</style>
