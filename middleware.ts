import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // ກວດສອບ Session — ໃຊ້ getUser() ເພື່ອ validate/refresh token ກ່ອນ (getSession() ບໍ່ refresh ເຮັດໃຫ້ເປັນໄປໜ້າ login ບໍ່ຈຳເປັນ)
  const { data: { user } } = await supabase.auth.getUser()

  // ຖ້າພະຍາຍามເຂົ້າ /admin ແຕ່ບໍ່ມີ user (session ໝົດອາຍຸ ຫຼື ບໍ່ມີ) ໃຫ້ດີດໄປໜ້າ login
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user && request.nextUrl.pathname !== '/admin/login') {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
