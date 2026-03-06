'use client';

import React from 'react';
import { PHOTO_GRID_GAP } from '@/utils/layoutConstants';

interface LayoutPreviewSelectorProps {
  selectedLayout: string;
  onLayoutChange: (layout: string) => void;
  previews: string[];
}

type LayoutType = 'default' | 'five-images' | 'car-gallery' | 'three-images' | 'one-top-three-bottom' | 'one-top-two-bottom' | 'one-left-three-right' | 'two-left-three-right';

interface LayoutPreview {
  id: LayoutType;
  name: string;
  render: () => React.ReactNode;
}

export const LayoutPreviewSelector = React.memo<LayoutPreviewSelectorProps>(
  ({ selectedLayout, onLayoutChange, previews }) => {
    const count = previews.length;
    if (count < 6) return null;

    const effectiveLayout = selectedLayout;

    const layouts: LayoutPreview[] = [
      {
        id: 'default',
        name: 'Default',
        render: () => (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: PHOTO_GRID_GAP,
              width: '100%',
              height: '100%',
              background: '#ffffff',
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  aspectRatio: '1',
                  background: '#b3d9e6',
                  borderRadius: '2px',
                }}
              />
            ))}
          </div>
        ),
      },
      {
        id: 'car-gallery',
        name: 'Car Gallery',
        render: () => (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: PHOTO_GRID_GAP,
              width: '100%',
              height: '100%',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateRows: '1fr 1fr',
                gap: PHOTO_GRID_GAP,
                background: '#ffffff',
              }}
            >
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: '1',
                    background: '#b3d9e6',
                    borderRadius: '2px',
                  }}
                />
              ))}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateRows: '1fr 1fr 1fr',
                gap: PHOTO_GRID_GAP,
                background: '#ffffff',
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    background: '#b3d9e6',
                    borderRadius: '2px',
                  }}
                />
              ))}
            </div>
          </div>
        ),
      },
      {
        id: 'two-left-three-right',
        name: '2 ซ้าย 3 ขวา',
        render: () => (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '3fr 2fr',
              gridTemplateRows: '1fr 1fr 1fr 1fr 1fr 1fr',
              gap: PHOTO_GRID_GAP,
              width: '100%',
              height: '100%',
              aspectRatio: '5/6',
              background: '#ffffff',
            }}
          >
            <div style={{ gridColumn: 1, gridRow: '1 / 4', background: '#b3d9e6', borderRadius: '2px' }} />
            <div style={{ gridColumn: 1, gridRow: '4 / 7', background: '#b3d9e6', borderRadius: '2px' }} />
            <div style={{ gridColumn: 2, gridRow: '1 / 3', background: '#b3d9e6', borderRadius: '2px' }} />
            <div style={{ gridColumn: 2, gridRow: '3 / 5', background: '#b3d9e6', borderRadius: '2px' }} />
            <div style={{ gridColumn: 2, gridRow: '5 / 7', background: '#b3d9e6', borderRadius: '2px' }} />
          </div>
        ),
      },
      {
        id: 'five-images',
        name: '5 รูป',
        render: () => (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: PHOTO_GRID_GAP,
              width: '100%',
              height: '100%',
              background: '#ffffff',
            }}
          >
            {[0, 1].map((i) => (
              <div
                key={i}
                style={{
                  aspectRatio: '1',
                  background: '#b3d9e6',
                  borderRadius: '2px',
                }}
              />
            ))}
            <div
              style={{
                gridColumn: 'span 2',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: PHOTO_GRID_GAP,
                background: '#ffffff',
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: '1',
                    background: '#b3d9e6',
                    borderRadius: '2px',
                  }}
                />
              ))}
            </div>
          </div>
        ),
      },
      {
        id: 'one-top-three-bottom',
        name: '1 บน 3 ล่าง',
        render: () => (
          <div
            style={{
              display: 'grid',
              gridTemplateRows: '2fr 1fr',
              gap: PHOTO_GRID_GAP,
              width: '100%',
              height: '100%',
              aspectRatio: '1',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                background: '#b3d9e6',
                borderRadius: '2px',
                minHeight: 0,
              }}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: PHOTO_GRID_GAP,
                background: '#ffffff',
                minHeight: 0,
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: '1',
                    background: '#b3d9e6',
                    borderRadius: '2px',
                  }}
                />
              ))}
            </div>
          </div>
        ),
      },
      {
        id: 'one-left-three-right',
        name: '1 ซ้าย 3 ขวา',
        render: () => (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gridTemplateRows: '1fr 1fr 1fr',
              gap: PHOTO_GRID_GAP,
              width: '100%',
              height: '100%',
              aspectRatio: '1',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                gridRow: 'span 3',
                background: '#b3d9e6',
                borderRadius: '2px',
              }}
            />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  aspectRatio: '1',
                  background: '#b3d9e6',
                  borderRadius: '2px',
                }}
              />
            ))}
          </div>
        ),
      },
      {
        id: 'one-top-two-bottom',
        name: '1 บน 2 ล่าง',
        render: () => (
          <div
            style={{
              display: 'grid',
              gridTemplateRows: '2fr 1fr',
              gap: PHOTO_GRID_GAP,
              width: '100%',
              height: '100%',
              aspectRatio: '1',
              background: '#ffffff',
            }}
          >
            <div style={{ background: '#b3d9e6', borderRadius: '2px', minHeight: 0 }} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: PHOTO_GRID_GAP,
                background: '#ffffff',
                minHeight: 0,
              }}
            >
              <div style={{ aspectRatio: '1', background: '#b3d9e6', borderRadius: '2px' }} />
              <div style={{ aspectRatio: '1', background: '#b3d9e6', borderRadius: '2px' }} />
            </div>
          </div>
        ),
      },
      {
        id: 'three-images',
        name: '3 รูป',
        render: () => (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: PHOTO_GRID_GAP,
              width: '100%',
              height: '100%',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                gridRow: 'span 2',
                background: '#b3d9e6',
                borderRadius: '2px',
              }}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateRows: '1fr 1fr',
                gap: PHOTO_GRID_GAP,
                background: '#ffffff',
              }}
            >
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: '1',
                    background: '#b3d9e6',
                    borderRadius: '2px',
                  }}
                />
              ))}
            </div>
          </div>
        ),
      },
    ];

    return (
      <div style={{ padding: '12px 15px', paddingTop: '16px' }}>
        <div
          style={{
            display: 'flex',
            gap: '3px',
            overflowX: 'auto',
            paddingBottom: '6px',
            scrollbarWidth: 'thin',
          }}
        >
          {layouts.map((layout, index) => (
            <div
              key={layout.id}
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => onLayoutChange(layout.id)}
                style={{
                  width: '40px',
                  aspectRatio: '1',
                  padding: '1px',
                  border: effectiveLayout === layout.id ? '2px solid #1877f2' : '2px solid #e0e0e0',
                  borderRadius: '4px',
                  background: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    overflow: 'hidden',
                    borderRadius: '1px',
                    background: '#ffffff',
                    padding: '1px',
                  }}
                >
                  {layout.render()}
                </div>
              </button>
              <span style={{ fontSize: '9px', fontWeight: 600, color: '#65676b' }}>{index + 1}</span>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

LayoutPreviewSelector.displayName = 'LayoutPreviewSelector';
