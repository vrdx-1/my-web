'use client';

const HOME_MOTION_PROFILER_FLAG = 'jutpai:home-motion-profiler';
const MAX_ENTRIES = 200;
let enabledCache = false;
let enabledCacheReady = false;

type HomeMotionProfilerChannel =
  | 'scroll-handler'
  | 'motion-apply'
  | 'feed-fetch'
  | 'feed-hydrate'
  | 'feed-cache'
  | 'frame-gap';

interface HomeMotionProfilerEntry {
  channel: HomeMotionProfilerChannel;
  name: string;
  durationMs: number;
  at: number;
  detail?: Record<string, unknown>;
}

interface HomeMotionProfilerStore {
  enabled: boolean;
  entries: HomeMotionProfilerEntry[];
}

interface HomeMotionProfilerSummaryItem {
  key: string;
  channel: HomeMotionProfilerChannel;
  name: string;
  count: number;
  avgMs: number;
  maxMs: number;
  minMs: number;
}

declare global {
  interface Window {
    __homeMotionProfiler?: HomeMotionProfilerStore;
  }
}

function getNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function isEnabled() {
  if (typeof window === 'undefined') return false;

  if (enabledCacheReady) return enabledCache;

  try {
    enabledCache = window.localStorage.getItem(HOME_MOTION_PROFILER_FLAG) === '1';
  } catch {
    enabledCache = false;
  }

  enabledCacheReady = true;
  return enabledCache;
}

function setEnabledCache(next: boolean) {
  enabledCache = next;
  enabledCacheReady = true;
}

function getStore() {
  if (typeof window === 'undefined') return null;

  if (!window.__homeMotionProfiler) {
    window.__homeMotionProfiler = {
      enabled: isEnabled(),
      entries: [],
    };
  }

  return window.__homeMotionProfiler;
}

function pushEntry(entry: HomeMotionProfilerEntry) {
  const store = getStore();
  if (!store?.enabled) return;

  store.entries.push(entry);
  if (store.entries.length > MAX_ENTRIES) {
    store.entries.splice(0, store.entries.length - MAX_ENTRIES);
  }
}

export function markHomeMotionEvent(name: string, detail?: Record<string, unknown>) {
  const store = getStore();
  if (!store?.enabled || typeof performance === 'undefined' || typeof performance.mark !== 'function') return;

  performance.mark(`home-motion:${name}`);
  if (detail && typeof console !== 'undefined') {
    console.debug('[home-motion]', name, detail);
  }
}

export function isHomeMotionProfilerEnabled() {
  const store = getStore();
  return !!store?.enabled;
}

export function startHomeMotionTimer(channel: HomeMotionProfilerChannel, name: string) {
  const store = getStore();
  if (!store?.enabled) return null;

  const start = getNow();
  return {
    channel,
    name,
    start,
  };
}

export function endHomeMotionTimer(
  timer: { channel: HomeMotionProfilerChannel; name: string; start: number } | null,
  detail?: Record<string, unknown>,
) {
  if (!timer) return;

  const durationMs = getNow() - timer.start;
  pushEntry({
    channel: timer.channel,
    name: timer.name,
    durationMs,
    at: Date.now(),
    detail,
  });

  if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
    try {
      performance.measure(`home-motion:${timer.channel}:${timer.name}`, {
        start: timer.start,
        duration: durationMs,
      } as PerformanceMeasureOptions);
    } catch {
      // ignore browsers that reject numeric measure options
    }
  }
}

export function recordHomeMotionDuration(
  channel: HomeMotionProfilerChannel,
  name: string,
  durationMs: number,
  detail?: Record<string, unknown>,
) {
  const store = getStore();
  if (!store?.enabled) return;

  pushEntry({
    channel,
    name,
    durationMs,
    at: Date.now(),
    detail,
  });
}

export function setHomeMotionProfilerEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;

  try {
    if (enabled) window.localStorage.setItem(HOME_MOTION_PROFILER_FLAG, '1');
    else window.localStorage.removeItem(HOME_MOTION_PROFILER_FLAG);
  } catch {
    // ignore storage failures
  }

  setEnabledCache(enabled);

  const store = getStore();
  if (store) store.enabled = enabled;
}

export function syncHomeMotionProfilerFromLocationSearch(search: string) {
  if (typeof URLSearchParams === 'undefined') return;

  const params = new URLSearchParams(search);
  const value = params.get('homePerf');
  if (value == null) return;

  if (value === '1' || value.toLowerCase() === 'true') {
    setHomeMotionProfilerEnabled(true);
    return;
  }

  if (value === '0' || value.toLowerCase() === 'false') {
    setHomeMotionProfilerEnabled(false);
  }
}

export function getHomeMotionProfilerSummary(limit = 20): HomeMotionProfilerSummaryItem[] {
  const store = getStore();
  if (!store) return [];

  const grouped = new Map<string, { channel: HomeMotionProfilerChannel; name: string; values: number[] }>();
  for (const entry of store.entries) {
    const key = `${entry.channel}:${entry.name}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.values.push(entry.durationMs);
      continue;
    }
    grouped.set(key, {
      channel: entry.channel,
      name: entry.name,
      values: [entry.durationMs],
    });
  }

  const items: HomeMotionProfilerSummaryItem[] = [];
  grouped.forEach((group, key) => {
    let total = 0;
    let max = Number.NEGATIVE_INFINITY;
    let min = Number.POSITIVE_INFINITY;
    for (const value of group.values) {
      total += value;
      if (value > max) max = value;
      if (value < min) min = value;
    }
    const count = group.values.length;
    items.push({
      key,
      channel: group.channel,
      name: group.name,
      count,
      avgMs: count > 0 ? total / count : 0,
      maxMs: count > 0 ? max : 0,
      minMs: count > 0 ? min : 0,
    });
  });

  items.sort((a, b) => b.maxMs - a.maxMs);
  return items.slice(0, limit);
}

export function getHomeMotionProfilerEntries() {
  const store = getStore();
  if (!store) return [] as HomeMotionProfilerEntry[];
  return [...store.entries];
}

export function clearHomeMotionProfilerEntries() {
  const store = getStore();
  if (!store) return;
  store.entries = [];
}