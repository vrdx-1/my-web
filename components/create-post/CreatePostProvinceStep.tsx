'use client';

import React from 'react';
import { ProvinceDropdown } from '@/components/ProvinceDropdown';

interface CreatePostProvinceStepProps {
  province: string;
  onProvinceChange: (province: string) => void;
}

export const CreatePostProvinceStep = React.memo<CreatePostProvinceStepProps>(
  ({ province, onProvinceChange }) => {
    return (
      <div style={{ padding: '10px 0' }}>
        <ProvinceDropdown
          selectedProvince={province}
          onProvinceChange={onProvinceChange}
          variant="list"
          className="createPostProvinceListTight"
        />
        <style jsx>{`
          :global(.createPostProvinceListTight) {
            display: block;
          }
          :global(.createPostProvinceListTight > div) {
            padding: 10px 24px !important;
            border-bottom: none !important;
          }

          @media (max-width: 520px) {
            :global(.createPostProvinceListTight > div) {
              padding: 8px 20px !important;
            }
            :global(.createPostProvinceListTight > div span) {
              font-size: 14px !important;
              line-height: 1.2 !important;
            }
            :global(.createPostProvinceListTight > div > div) {
              width: 18px !important;
              height: 18px !important;
            }
            :global(.createPostProvinceListTight > div > div svg) {
              width: 10px !important;
              height: 10px !important;
            }
          }
        `}</style>
      </div>
    );
  },
);

CreatePostProvinceStep.displayName = 'CreatePostProvinceStep';

