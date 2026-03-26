# Home Performance Profiling (Mobile)

Use this guide to compare before/after performance on real mobile devices.

## Enable profiler

- Option A: add query flag once
  - `/home?homePerf=1`
- Option B: use console helper
  - `window.__homePerfEnable()`

Disable with:

- `/home?homePerf=0`
- `window.__homePerfDisable()`

## Collect summary

Run in browser console:

```js
window.__homePerfSummary()
```

## One-shot trace (recommended)

Run one full capture in a single command:

```js
window.__homePerfTraceOnce()
```

Or open with query:

- `/home?homePerf=1&homePerfTrace=1`

After ~8 seconds it prints summary table automatically.

Helpers:

- `window.__homePerfReset()` clears stored entries
- `window.__homePerfSummary()` prints grouped summary

The summary is sorted by highest max duration and includes:

- `scroll-handler:*` header scroll frame processing time
- `motion-apply:*` header show/hide state changes
- `feed-hydrate:*` image gate preload/cache-hit timing
- `frame-gap:*` dropped-frame style gaps on home feed (first 10s)
- existing `feed-fetch:*` and `feed-cache:*` network/cache timings

## Suggested test flow (real mobile)

1. Open `/home?homePerf=1` from cold start.
2. Wait until first feed render is visible.
3. Scroll up/down for 10-15 seconds.
4. Switch tabs `/home -> /notification -> /home` once.
5. Run `window.__homePerfSummary()` and capture screenshot/log.
6. Repeat the same flow after code changes and compare top max/avg values.

## Notes

- Profiler stores only recent entries (bounded ring buffer).
- When disabled, runtime overhead is minimal.
