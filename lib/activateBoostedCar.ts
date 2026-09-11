import type { SupabaseClient } from '@supabase/supabase-js';

export async function setCarBoosted(
  admin: SupabaseClient,
  postId: string,
  expiresAt: string | null,
): Promise<{ id: string; is_boosted: boolean | null }> {
  const { data, error } = await admin
    .from('cars')
    .update({ is_boosted: true, boost_expiry: expiresAt })
    .eq('id', postId)
    .select('id, is_boosted')
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data?.id) {
    throw new Error('CAR_BOOST_UPDATE_EMPTY');
  }

  return data as { id: string; is_boosted: boolean | null };
}

export async function canActivateCarBoost(params: {
  admin: SupabaseClient;
  authUserId: string;
  carUserId: string;
}): Promise<boolean> {
  const { admin, authUserId, carUserId } = params;
  if (!carUserId) return false;
  if (carUserId === authUserId) return true;

  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('id, parent_admin_id')
    .eq('id', carUserId)
    .maybeSingle();

  return String(ownerProfile?.parent_admin_id || '') === authUserId;
}
