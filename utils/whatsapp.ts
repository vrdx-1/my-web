export const WHATSAPP_NUMBER_SOURCES = ['self', 'admin'] as const;

export type WhatsAppNumberSource = (typeof WHATSAPP_NUMBER_SOURCES)[number];

type ParentAdminPhoneRecord = {
  phone?: string | null;
} | null;

export type WhatsAppProfileLike = {
  phone?: string | null;
  is_sub_account?: boolean | null;
  parent_admin_id?: string | null;
  whatsapp_number_source?: string | null;
  parent_admin?: ParentAdminPhoneRecord;
  effective_whatsapp_phone?: string | null;
};

export function normalizeWhatsAppNumberSource(value: string | null | undefined): WhatsAppNumberSource {
  return value === 'admin' ? 'admin' : 'self';
}

export function shouldUseAdminWhatsApp(profile: WhatsAppProfileLike | null | undefined): boolean {
  if (!profile) return false;

  return Boolean(
    profile.is_sub_account &&
      profile.parent_admin_id &&
      normalizeWhatsAppNumberSource(profile.whatsapp_number_source) === 'admin'
  );
}

export function resolveEffectiveWhatsAppPhone(profile: WhatsAppProfileLike | null | undefined): string | null {
  if (!profile) return null;
  if (profile.effective_whatsapp_phone) return profile.effective_whatsapp_phone;

  if (shouldUseAdminWhatsApp(profile)) {
    return profile.parent_admin?.phone?.trim() || null;
  }

  return profile.phone?.trim() || null;
}

export function formatStoredWhatsAppPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.startsWith('85620') && trimmed.length === 13) {
    return `020${trimmed.slice(5)}`;
  }
  return trimmed;
}

export function toStoredWhatsAppPhone(phone: string): string {
  if (phone.startsWith('020') && phone.length === 11) {
    return `85620${phone.slice(3)}`;
  }
  return phone;
}

export async function attachEffectiveWhatsAppPhones<T extends Record<string, any>>(
  client: { from: (table: 'profiles') => any },
  posts: T[]
): Promise<T[]> {
  if (!Array.isArray(posts) || posts.length === 0) return posts;

  const ownerIds = Array.from(
    new Set(
      posts
        .map((post) => String(post?.user_id || '').trim())
        .filter((value) => Boolean(value))
    )
  );

  if (ownerIds.length === 0) return posts;

  let ownerRows: Array<{
    id: string;
    phone: string | null;
    is_sub_account?: boolean | null;
    parent_admin_id?: string | null;
    whatsapp_number_source?: string | null;
  }> = [];

  const ownerWithSource = await client
    .from('profiles')
    .select('id, phone, is_sub_account, parent_admin_id, whatsapp_number_source')
    .in('id', ownerIds);

  if (ownerWithSource?.error && String(ownerWithSource.error?.code || '') === '42703') {
    const ownerFallback = await client
      .from('profiles')
      .select('id, phone, is_sub_account, parent_admin_id')
      .in('id', ownerIds);
    ownerRows = (ownerFallback?.data || []).map((row: any) => ({
      ...row,
      whatsapp_number_source: 'self',
    }));
  } else {
    ownerRows = ownerWithSource?.data || [];
  }

  const ownerMap = new Map<string, {
    id: string;
    phone: string | null;
    is_sub_account?: boolean | null;
    parent_admin_id?: string | null;
    whatsapp_number_source?: string | null;
  }>();

  for (const row of ownerRows) {
    ownerMap.set(String(row.id), row);
  }

  const parentAdminIds = Array.from(
    new Set(
      ownerRows
        .map((row) => {
          const source = normalizeWhatsAppNumberSource(row.whatsapp_number_source);
          if (!row?.is_sub_account || source !== 'admin') return null;
          return String(row.parent_admin_id || '').trim() || null;
        })
        .filter((value): value is string => Boolean(value))
    )
  );

  const parentPhoneMap = new Map<string, string | null>();

  if (parentAdminIds.length > 0) {
    const { data } = await client.from('profiles').select('id, phone').in('id', parentAdminIds);
    for (const row of data || []) {
      parentPhoneMap.set(String(row.id), row.phone?.trim() || null);
    }
  }

  return posts.map((post) => {
    const profile = post?.profiles as WhatsAppProfileLike | null | undefined;
    if (!profile) return post;

    const ownerRow = ownerMap.get(String(post?.user_id || ''));

    const resolvedProfile: WhatsAppProfileLike = {
      ...profile,
      phone: ownerRow?.phone ?? profile.phone ?? null,
      is_sub_account: ownerRow?.is_sub_account ?? profile.is_sub_account ?? false,
      parent_admin_id: ownerRow?.parent_admin_id ?? profile.parent_admin_id ?? null,
      whatsapp_number_source: normalizeWhatsAppNumberSource(ownerRow?.whatsapp_number_source ?? profile.whatsapp_number_source),
    };

    const parentAdminId = String(resolvedProfile.parent_admin_id || '').trim();
    const parentPhone = parentAdminId
      ? parentPhoneMap.get(parentAdminId) ?? resolvedProfile.parent_admin?.phone?.trim() ?? null
      : null;
    const effectivePhone = shouldUseAdminWhatsApp(resolvedProfile)
      ? parentPhone
      : resolvedProfile.phone?.trim() || null;

    return {
      ...post,
      profiles: {
        ...resolvedProfile,
        parent_admin: resolvedProfile.parent_admin ?? (parentAdminId ? { phone: parentPhone } : null),
        effective_whatsapp_phone: effectivePhone,
      },
    };
  });
}