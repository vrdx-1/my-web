'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function VisitorTracker() {
  const pathname = usePathname()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const track = async () => {
      try {
        let vId = localStorage.getItem('visitor_id')
        let isFirstVisit = false
        if (!vId) {
          vId = crypto.randomUUID()
          localStorage.setItem('visitor_id', vId)
          isFirstVisit = true
        }

        const { data: { user } } = await supabase.auth.getUser()

        await supabase.from('visitor_logs').insert({
          visitor_id: vId,
          user_id: user?.id ?? null,
          page_path: window.location.pathname,
          user_agent: navigator.userAgent,
          is_first_visit: isFirstVisit
        })
      } catch (error) {
        console.error('Error tracking visitor:', error)
      }
    }

    const scheduleTrack = () => {
      if (typeof requestIdleCallback !== 'undefined') {
        return requestIdleCallback(() => { track() }, { timeout: 3000 })
      }
      return window.setTimeout(() => { track() }, 1500) as unknown as number
    }
    const cancelScheduled = (id: number) => {
      if (typeof cancelIdleCallback !== 'undefined') cancelIdleCallback(id)
      else clearTimeout(id)
    }
    const scheduledId = scheduleTrack()

    return () => {
      cancelScheduled(scheduledId)
    }
  }, [pathname])

  return null
}
