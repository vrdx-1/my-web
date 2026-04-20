type AdminLikeClient = {
  from: (table: string) => {
    select: (columns: string) => {
      or: (filters: string) => Promise<{
        data: Array<{ id: string; parent_admin_id?: string | null }> | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export async function getOwnedProfileIdsForServer(
  admin: AdminLikeClient,
  options: {
    activeProfileId?: string | null;
    authUserId?: string | null;
  },
): Promise<string[]> {
  const activeProfileId = options.activeProfileId ? String(options.activeProfileId) : null;
  const authUserId = options.authUserId ? String(options.authUserId) : null;
  const effectiveProfileId = activeProfileId || authUserId;

  if (!effectiveProfileId) return [];
  if (!authUserId || effectiveProfileId !== authUserId) {
    return [effectiveProfileId];
  }

  const { data, error } = await admin
    .from('profiles')
    .select('id, parent_admin_id')
    .or(`id.eq.${authUserId},parent_admin_id.eq.${authUserId}`);

  if (error || !data || data.length === 0) {
    return [authUserId];
  }

  const ownedProfileIds = new Set<string>([authUserId]);
  data.forEach((profile) => {
    if (!profile?.id) return;
    ownedProfileIds.add(String(profile.id));
  });

  return [...ownedProfileIds];
}

export async function isOwnedByServerProfileScope(
  admin: AdminLikeClient,
  postUserId: string | null | undefined,
  options: {
    activeProfileId?: string | null;
    authUserId?: string | null;
  },
): Promise<boolean> {
  if (!postUserId) return false;
  const ownedProfileIds = await getOwnedProfileIdsForServer(admin, options);
  return ownedProfileIds.some((profileId) => String(profileId) === String(postUserId));
}