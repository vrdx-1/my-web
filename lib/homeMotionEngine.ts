'use client';

export type MotionPlatformTier = 'desktop' | 'mobile-normal' | 'mobile-low-end';

export interface MotionInputSnapshot {
  now: number;
  interactionWindowMs: number;
  frameGapMs: number;
  frameGapEmaMs: number;
}

export interface MotionInputTracker {
  markInteraction: (now: number) => MotionInputSnapshot;
  isInteractionActive: (now: number) => boolean;
  getFrameGapEmaMs: () => number;
}

export function createMotionInputTracker(options: {
  getPlatformTier: () => MotionPlatformTier;
}): MotionInputTracker {
  let interactionActiveUntil = 0;
  let frameGapEmaMs = 16.7;
  let lastInputAt: number | null = null;

  const getInteractionWindowMs = () => {
    const tier = options.getPlatformTier();
    const framesMultiplier = tier === 'mobile-low-end' ? 6 : tier === 'mobile-normal' ? 5 : 4;
    return Math.min(200, Math.max(64, Math.round(frameGapEmaMs * framesMultiplier)));
  };

  const markInteraction = (now: number) => {
    let frameGapMs = 0;
    if (lastInputAt != null) {
      frameGapMs = now - lastInputAt;
      if (frameGapMs > 4 && frameGapMs < 500) {
        frameGapEmaMs = frameGapEmaMs * 0.85 + frameGapMs * 0.15;
      }
    }
    lastInputAt = now;
    const interactionWindowMs = getInteractionWindowMs();
    interactionActiveUntil = now + interactionWindowMs;

    return {
      now,
      interactionWindowMs,
      frameGapMs,
      frameGapEmaMs,
    };
  };

  return {
    markInteraction,
    isInteractionActive: (now: number) => now <= interactionActiveUntil,
    getFrameGapEmaMs: () => frameGapEmaMs,
  };
}

export interface ScrollStateMachineInput {
  currentScrollY: number;
  scrollDelta: number;
  showThresholdPx: number;
  hideThresholdPx: number;
  activeDeltaThreshold: number;
  interactionActive: boolean;
}

export type ScrollZone =
  | 'show-interacting'
  | 'interacting-transform-only'
  | 'show'
  | 'hide'
  | 'between';

export interface ScrollStateMachineOutput {
  zone: ScrollZone;
  forceProgress?: number;
  applyVisibility?: 'show' | 'hide';
  useHideThrottle: boolean;
  shouldSettle: boolean;
  shouldProgressFollowDelta: boolean;
}

export function resolveScrollStateMachine(input: ScrollStateMachineInput): ScrollStateMachineOutput {
  const {
    currentScrollY,
    scrollDelta,
    showThresholdPx,
    hideThresholdPx,
    activeDeltaThreshold,
    interactionActive,
  } = input;

  if (interactionActive) {
    if (currentScrollY <= showThresholdPx) {
      return {
        zone: 'show-interacting',
        forceProgress: 0,
        useHideThrottle: false,
        shouldSettle: true,
        shouldProgressFollowDelta: false,
      };
    }

    return {
      zone: 'interacting-transform-only',
      useHideThrottle: false,
      shouldSettle: true,
      shouldProgressFollowDelta: scrollDelta !== 0,
    };
  }

  if (currentScrollY <= showThresholdPx) {
    return {
      zone: 'show',
      forceProgress: 0,
      applyVisibility: 'show',
      useHideThrottle: false,
      shouldSettle: true,
      shouldProgressFollowDelta: false,
    };
  }

  if (currentScrollY >= hideThresholdPx) {
    let applyVisibility: 'show' | 'hide' | undefined;
    if (scrollDelta > activeDeltaThreshold) applyVisibility = 'hide';
    if (scrollDelta < -activeDeltaThreshold) applyVisibility = 'show';

    return {
      zone: 'hide',
      applyVisibility,
      useHideThrottle: true,
      shouldSettle: true,
      shouldProgressFollowDelta: scrollDelta !== 0,
    };
  }

  return {
    zone: 'between',
    applyVisibility: scrollDelta < -activeDeltaThreshold ? 'show' : undefined,
    useHideThrottle: false,
    shouldSettle: true,
    shouldProgressFollowDelta: scrollDelta !== 0,
  };
}

class MotionDebugOverlay {
  private root: HTMLDivElement | null = null;
  private enabled = false;

  constructor() {
    if (typeof window === 'undefined') return;
    try {
      this.enabled = window.localStorage.getItem('jutpai:home-motion-overlay') === '1';
    } catch {
      this.enabled = false;
    }
    if (this.enabled) this.mount();
  }

  private mount() {
    if (typeof document === 'undefined' || this.root) return;
    const el = document.createElement('div');
    el.setAttribute('data-home-motion-overlay', '1');
    el.style.position = 'fixed';
    el.style.left = '8px';
    el.style.bottom = '92px';
    el.style.zIndex = '9999';
    el.style.padding = '8px 10px';
    el.style.borderRadius = '8px';
    el.style.background = 'rgba(10, 14, 20, 0.86)';
    el.style.color = '#d6f5e8';
    el.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    el.style.fontSize = '11px';
    el.style.lineHeight = '1.35';
    el.style.pointerEvents = 'none';
    el.style.whiteSpace = 'pre';
    document.body.appendChild(el);
    this.root = el;
  }

  update(lines: string[]) {
    if (!this.enabled) return;
    if (!this.root) this.mount();
    if (!this.root) return;
    this.root.textContent = lines.join('\n');
  }

  destroy() {
    if (this.root?.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
  }
}

export interface MotionRenderSample {
  platform: 'ios' | 'android';
  tier: MotionPlatformTier;
  zone: ScrollZone;
  progress: number;
  interacting: boolean;
  frameGapEmaMs: number;
  frameGapMs: number;
  inputToEmitLatencyMs: number;
}

export function createMotionRenderer(options: {
  onRender: (progress: number, interacting: boolean) => void;
}) {
  const overlay = new MotionDebugOverlay();

  return {
    emit: (progress: number, interacting: boolean, sample: MotionRenderSample) => {
      options.onRender(progress, interacting);
      overlay.update([
        `motion=${sample.platform}/${sample.tier}`,
        `zone=${sample.zone} interacting=${sample.interacting ? 1 : 0}`,
        `progress=${sample.progress.toFixed(3)} latency=${sample.inputToEmitLatencyMs.toFixed(1)}ms`,
        `frameGap=${sample.frameGapMs.toFixed(1)}ms ema=${sample.frameGapEmaMs.toFixed(1)}ms`,
      ]);
    },
    destroy: () => overlay.destroy(),
  };
}
