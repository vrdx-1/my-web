import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function createSupabaseClient() {
	if (typeof window === 'undefined') {
		return createClient(supabaseUrl, supabaseAnonKey)
	}

	return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = createSupabaseClient()