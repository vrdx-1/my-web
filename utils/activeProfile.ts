export const ACTIVE_PROFILE_HEADER = 'x-active-profile-id';

export function createActiveProfileHeaders(activeProfileId?: string | null): HeadersInit | undefined {
  if (!activeProfileId) return undefined;
  return { [ACTIVE_PROFILE_HEADER]: activeProfileId };
}

export function mergeHeaders(
  baseHeaders: HeadersInit | undefined,
  activeProfileId?: string | null
): HeadersInit | undefined {
  const activeHeaders = createActiveProfileHeaders(activeProfileId);
  if (!baseHeaders) return activeHeaders;
  if (!activeHeaders) return baseHeaders;
  return {
    ...(baseHeaders as Record<string, string>),
    ...(activeHeaders as Record<string, string>),
  };
}