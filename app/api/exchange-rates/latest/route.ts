import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_EXCHANGE_RATES, normalizeExchangeRates } from '@/utils/exchangeRates';

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } },
  );
}

export async function GET() {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ rates: DEFAULT_EXCHANGE_RATES });
  }

  const { data } = await admin
    .from('exchange_rates')
    .select('lak_to_thb, lak_to_usd, thb_to_lak, thb_to_usd, usd_to_lak, usd_to_thb')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ rates: normalizeExchangeRates(data) });
}
