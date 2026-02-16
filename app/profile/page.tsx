'use client';

import { useRouter } from 'next/navigation';
import { useProfileSlideBack } from './ProfileSlideContext';
import { ProfileContent } from '@/components/ProfileContent';

export default function Profile() {
  const router = useRouter();
  const requestBack = useProfileSlideBack();

  return (
    <ProfileContent
      onBack={requestBack ? () => requestBack() : () => router.push('/')}
    />
  );
}
