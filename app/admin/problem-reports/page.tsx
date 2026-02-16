'use client'

import { useState, useEffect } from 'react'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants'
import { createBrowserClient } from '@supabase/ssr'

type Report = {
  id: string
  user_id: string
  message: string
  image_urls: string[] | null
  status: string
  created_at: string
  updated_at: string
  profiles: { username: string | null; avatar_url: string | null } | null
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('th-LA', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default function AdminProblemReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('ກະລຸນາເຂົ້າສູ່ລະບົບ')
        return
      }
      const res = await fetch('/api/admin/problem-reports', { credentials: 'include' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        const msg = j?.error || `Error ${res.status}`
        setError(
          res.status === 401
            ? 'ກະລຸນາເຂົ້າສູ່ລະບົບ Admin ກ່ອນ'
            : res.status === 403
              ? 'ບັນຊີນີ້ບໍ່ມີສິດ Admin'
              : res.status === 503
                ? 'ບໍ່ມີ SUPABASE_SERVICE_ROLE_KEY ໃນ .env.local'
                : msg
        )
        return
      }
      const json = await res.json()
      setReports(json.reports ?? [])
    } catch (e: any) {
      setError(e?.message || 'ເກີດຂໍ້ຜິດພາດ')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id)
    try {
      const res = await fetch('/api/admin/problem-reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
        credentials: 'include',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j?.error || 'Update failed')
        return
      }
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      )
    } catch (e: any) {
      alert(e?.message || 'Update failed')
    } finally {
      setUpdatingId(null)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <main style={LAYOUT_CONSTANTS.ADMIN_CONTAINER}>
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#111', margin: 0 }}>
            ລາຍງານບັນຫາຈາກຜູ້ໃຊ້ ({reports.length})
          </h2>
          <button
            type="button"
            onClick={() => fetchReports()}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            ໂຫຼດໃໝ່
          </button>
        </div>
        {error && (
          <div style={{ padding: '12px', background: '#fff5f5', color: '#c92a2a', borderRadius: '8px', marginBottom: '16px' }}>
            {error}
          </div>
        )}
        {reports.length === 0 && !error && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#65676b' }}>
            ບໍ່ມີລາຍງານບັນຫາ
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {reports.map((r) => (
            <div
              key={r.id}
              style={{
                background: '#fff',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #eee',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                {r.profiles?.avatar_url ? (
                  <img
                    src={r.profiles.avatar_url}
                    alt=""
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e4e6eb' }} />
                )}
                <div>
                  <div style={{ fontWeight: '600', color: '#111' }}>
                    {r.profiles?.username || r.user_id}
                  </div>
                  <div style={{ fontSize: '13px', color: '#65676b' }}>
                    {formatDate(r.created_at)}
                  </div>
                </div>
              </div>
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: '15px',
                  lineHeight: 1.5,
                  color: '#1c1e21',
                  marginBottom: r.image_urls?.length ? '12px' : 0,
                }}
              >
                {r.message}
              </div>
              {r.image_urls && r.image_urls.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {r.image_urls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'block' }}
                    >
                      <img
                        src={url}
                        alt=""
                        style={{
                          width: '100px',
                          height: '100px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid #eee',
                        }}
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
