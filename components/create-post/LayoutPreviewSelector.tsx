'use client';

import React from 'react';

interface LayoutPreviewSelectorProps {
  selectedLayout: string;
  onLayoutChange: (layout: string) => void;
  previews: string[];
}

type LayoutType = 'default' | 'five-images' | 'five-images-side' | 'three-images';

interface LayoutPreview {
  id: LayoutType;
  name: string;
  render: () => React.ReactNode;
}

export const LayoutPreviewSelector = React.memo<LayoutPreviewSelectorProps>(
  ({ selectedLayout, onLayoutChange, previews }) => {
    const count = previews.length;
    if (count < 6) return null;

    // ใช้ count เท่านั้น ไม่ใช้ previews ใน render

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
              gap: '4px',
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
        id: 'five-images',
        name: '5 รูป',
        render: () => (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px',
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
                gap: '4px',
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
        id: 'five-images-side',
        name: '5 รูป',
        render: () => (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr',
              gap: '4px',
              width: '100%',
              height: '100%',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateRows: '1fr 1fr',
                gap: '4px',
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
                gap: '4px',
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
        id: 'three-images',
        name: '3 รูป',
        render: () => (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '4px',
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
                gap: '4px',
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
      <div style={{ padding: '15px', paddingTop: '20px' }}>
        <div
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '8px',
            scrollbarWidth: 'thin',
          }}
        >
          {layouts.map((layout) => (
            <button
              key={layout.id}
              type="button"
              onClick={() => onLayoutChange(layout.id)}
              style={{
                flexShrink: 0,
                width: '90px',
                aspectRatio: '1',
                padding: '4px',
                border: selectedLayout === layout.id ? '2px solid #1877f2' : '2px solid #e0e0e0',
                borderRadius: '6px',
                background: '#fff',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  overflow: 'hidden',
                  borderRadius: '3px',
                  background: '#ffffff',
                  padding: '2px',
                }}
              >
                {layout.render()}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  },
);

LayoutPreviewSelector.displayName = 'LayoutPreviewSelector';
