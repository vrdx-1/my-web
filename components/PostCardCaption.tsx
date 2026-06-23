'use client'

import React from 'react';

const CAPTION_TOGGLE_TRANSITION_LOCK_MS = 260;

interface PostCardCaptionProps {
  normalizedCaption: string;
  customCaption?: React.ReactNode;
}

export function PostCardCaption({
  normalizedCaption,
  customCaption,
}: PostCardCaptionProps) {
  const [isCaptionExpanded, setIsCaptionExpanded] = React.useState(false);
  const [isCaptionOverflowing, setIsCaptionOverflowing] = React.useState(false);
  const [isCaptionSingleLine, setIsCaptionSingleLine] = React.useState(false);
  const [collapsedCaption, setCollapsedCaption] = React.useState('');
  const captionRef = React.useRef<HTMLDivElement | null>(null);
  const captionToggleUnlockTimeoutRef = React.useRef<number | null>(null);

  const clearCaptionToggleStabilizers = React.useCallback(() => {
    if (typeof window !== 'undefined' && captionToggleUnlockTimeoutRef.current != null) {
      window.clearTimeout(captionToggleUnlockTimeoutRef.current);
      captionToggleUnlockTimeoutRef.current = null;
    }
    if (typeof document !== 'undefined') {
      delete document.body.dataset.captionToggleActive;
    }
  }, []);

  const updateCollapsedCaption = React.useCallback(() => {
    const captionEl = captionRef.current;
    const fullCaption = normalizedCaption;

    if (!captionEl || fullCaption.trim() === '') {
      setIsCaptionOverflowing(false);
      setIsCaptionSingleLine(false);
      setCollapsedCaption(fullCaption);
      return;
    }

    const style = window.getComputedStyle(captionEl);
    const paddingLeft = parseFloat(style.paddingLeft || '0');
    const paddingRight = parseFloat(style.paddingRight || '0');
    const contentWidth = Math.max(0, captionEl.clientWidth - paddingLeft - paddingRight);
    const lineHeight = 21;
    const maxHeight = lineHeight * 2;

    if (contentWidth <= 0) {
      setIsCaptionOverflowing(false);
      setIsCaptionSingleLine(false);
      setCollapsedCaption(fullCaption);
      return;
    }

    const measureEl = document.createElement('div');
    measureEl.style.position = 'fixed';
    measureEl.style.left = '-99999px';
    measureEl.style.top = '0';
    measureEl.style.width = `${contentWidth}px`;
    measureEl.style.whiteSpace = 'pre-wrap';
    measureEl.style.wordBreak = 'break-word';
    measureEl.style.fontSize = style.fontSize;
    measureEl.style.fontWeight = style.fontWeight;
    measureEl.style.fontFamily = style.fontFamily;
    measureEl.style.lineHeight = `${lineHeight}px`;
    measureEl.style.letterSpacing = style.letterSpacing;
    measureEl.style.visibility = 'hidden';
    measureEl.style.pointerEvents = 'none';

    document.body.appendChild(measureEl);

    const readMoreSuffix = ' ອ່ານເພີ່ມ';
    const ellipsis = '...';

    measureEl.textContent = fullCaption;
    const measuredHeight = measureEl.scrollHeight;
    const fullFits = measuredHeight <= maxHeight + 1;
    setIsCaptionSingleLine(measuredHeight <= lineHeight + 1);

    if (fullFits) {
      document.body.removeChild(measureEl);
      setIsCaptionOverflowing(false);
      setCollapsedCaption(fullCaption);
      return;
    }

    let low = 0;
    let high = fullCaption.length;
    let best = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = `${fullCaption.slice(0, mid).trimEnd()}${ellipsis}${readMoreSuffix}`;
      measureEl.textContent = candidate;

      if (measureEl.scrollHeight <= maxHeight + 1) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    document.body.removeChild(measureEl);
    setIsCaptionOverflowing(true);
    setCollapsedCaption(`${fullCaption.slice(0, best).trimEnd()}${ellipsis}`);
  }, [normalizedCaption]);

  const handleCaptionToggle = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCaptionOverflowing) return;
    if (typeof window !== 'undefined') {
      if (typeof document !== 'undefined') {
        document.body.dataset.captionToggleActive = 'true';
      }
      if (captionToggleUnlockTimeoutRef.current != null) {
        window.clearTimeout(captionToggleUnlockTimeoutRef.current);
      }
      captionToggleUnlockTimeoutRef.current = window.setTimeout(() => {
        captionToggleUnlockTimeoutRef.current = null;
        if (typeof document !== 'undefined') {
          delete document.body.dataset.captionToggleActive;
        }
      }, CAPTION_TOGGLE_TRANSITION_LOCK_MS);
      window.dispatchEvent(new CustomEvent('postcard:caption-toggle'));
    }
    setIsCaptionExpanded((prev) => !prev);
  }, [isCaptionOverflowing]);

  React.useEffect(() => {
    clearCaptionToggleStabilizers();
    setIsCaptionExpanded(false);
  }, [normalizedCaption, clearCaptionToggleStabilizers]);

  React.useEffect(() => clearCaptionToggleStabilizers, [clearCaptionToggleStabilizers]);

  React.useEffect(() => {
    if (isCaptionExpanded) return;

    updateCollapsedCaption();

    const captionEl = captionRef.current;
    if (!captionEl) return;

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateCollapsedCaption);
      return () => window.removeEventListener('resize', updateCollapsedCaption);
    }

    const observer = new ResizeObserver(() => updateCollapsedCaption());
    observer.observe(captionEl);
    return () => observer.disconnect();
  }, [isCaptionExpanded, updateCollapsedCaption]);

  if (customCaption) {
    return <>{customCaption}</>;
  }

  if (normalizedCaption.trim() === '') {
    return null;
  }

  return (
    <div
      role="text"
      ref={captionRef}
      onClick={handleCaptionToggle}
      style={{
        padding: isCaptionExpanded
          ? '0 15px 0 15px'
          : isCaptionSingleLine
            ? '0 15px 4px 15px'
            : '0 15px 8px 15px',
        marginBottom: isCaptionExpanded ? '6px' : isCaptionSingleLine ? '2px' : '6px',
        fontSize: '15px',
        lineHeight: '21px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        color: '#111111',
        fontWeight: 500,
        userSelect: 'text',
        WebkitUserSelect: 'text',
        overflow: isCaptionExpanded ? 'visible' : 'hidden',
        maxHeight: isCaptionExpanded ? 'none' : '42px',
        overflowAnchor: 'none',
        cursor: isCaptionOverflowing ? 'pointer' : 'text',
      }}
    >
      {isCaptionExpanded || !isCaptionOverflowing ? normalizedCaption : collapsedCaption}
      {!isCaptionExpanded && isCaptionOverflowing && (
        <button
          type="button"
          onClick={handleCaptionToggle}
          aria-label="ອ່ານເພີ່ມ"
          style={{
            border: 'none',
            background: 'transparent',
            color: '#8a8d91',
            fontSize: '15px',
            lineHeight: '21px',
            fontWeight: 400,
            cursor: 'pointer',
            marginLeft: '4px',
            padding: 0,
          }}
        >
          ອ່ານເພີ່ມ
        </button>
      )}
    </div>
  );
}
