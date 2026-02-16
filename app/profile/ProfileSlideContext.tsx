'use client';

import React, { createContext, useContext, useCallback } from 'react';

type RequestBackFn = () => void;

const ProfileSlideContext = createContext<RequestBackFn | null>(null);

export function useProfileSlideBack(): RequestBackFn | null {
  return useContext(ProfileSlideContext);
}

export function ProfileSlideProvider({
  requestBack,
  children,
}: {
  requestBack: RequestBackFn;
  children: React.ReactNode;
}) {
  return (
    <ProfileSlideContext.Provider value={requestBack}>
      {children}
    </ProfileSlideContext.Provider>
  );
}
