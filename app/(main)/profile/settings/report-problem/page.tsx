'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LAO_FONT } from '@/utils/constants'
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile'
import { useImageUpload } from '@/hooks/useImageUpload'
import { ButtonSpinner } from '@/components/LoadingSpinner'
import { compressImage } from '@/utils/imageCompression'

const BUCKET_NAME = 'report-images'
const MAX_IMAGES = 5
const MAX_LINES = 15
const LINE_HEIGHT_PX = 22

export default function ReportProblemPage() {
  const router = useRouter()
  const { session } = useSessionAndProfile()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const imageUpload = useImageUpload({
    maxFiles: MAX_IMAGES,
    compressMaxWidth: 720,
    compressQuality: 0.5,
  })

  const [sessionChecked, setSessionChecked] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_LINES * LINE_HEIGHT_PX)}px`
  }, [message])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!cancelled) {
        setSessionChecked(true)
        if (!s) router.replace('/login')
      }
    })
    return () => { cancelled = true }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitMessage(null)
    const trimmed = message.trim()
    if (!trimmed) {
      setSubmitMessage({ text: 'ກະລຸນາໃສ່ລາຍລະອຽດບັນຫາ', type: 'error' })
      return
    }
    if (!session?.user?.id) {
      setSubmitMessage({ text: 'ກະລຸນາເຂົ້າສູ່ລະບົບ', type: 'error' })
      return
    }

    setLoading(true)
    const uploadedPaths: string[] = []
    try {
      const files = imageUpload.selectedFiles.slice(0, MAX_IMAGES)
      const imageUrls: string[] = []

      if (files.length > 0) {
        const compressed = await Promise.all(
          files.map((f) => compressImage(f, 720, 0.5))
        )
        const userId = session.user.id
        for (let i = 0; i < compressed.length; i++) {
          const file = compressed[i]
          const ext = file.type === 'image/jpeg' ? 'jpg' : 'webp'
          const fileName = `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}.${ext}`
          const path = `${userId}/${fileName}`
          const { error: upErr } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(path, file)
          if (upErr) {
            for (const p of uploadedPaths) {
              await supabase.storage.from(BUCKET_NAME).remove([p]).catch(() => {})
            }
            throw upErr
          }
          uploadedPaths.push(path)
          const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path)
          imageUrls.push(publicUrl)
        }
      }

      const { error: insertErr } = await supabase.from('user_problem_reports').insert({
        user_id: session.user.id,
        message: trimmed,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        status: 'pending',
      })

      if (insertErr) throw insertErr
      setSubmitMessage({ text: 'ສົ່ງລາຍງານບັນຫາສຳເລັດ', type: 'success' })
      setMessage('')
      imageUpload.clearImages()
    } catch (err: any) {
      setSubmitMessage({
        text: err?.message || 'ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!sessionChecked || !session) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: LAO_FONT }}>
        ກຳລັງໂຫຼດ...
      </div>
    )
  }

  return (
    <main
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        background: '#ffffff',
        backgroundColor: '#ffffff',
        minHeight: '100vh',
        overflowY: 'auto',
        fontFamily: LAO_FONT,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '20px 15px 10px 15px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'sticky',
          top: 0,
          background: '#ffffff',
          backgroundColor: '#ffffff',
          zIndex: 100,
          borderBottom: '1px solid #ddd',
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1c1e21',
            padding: 0,
            position: 'absolute',
            left: '15px',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1c1e21' }}>
          ລາຍງານບັນຫາ
        </h1>
      </div>

      <div style={{ padding: '20px' }}>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: '15px', fontWeight: '600', color: '#1c1e21', marginBottom: '8px' }}>
            ລາຍລະອຽດບັນຫາ
          </label>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              const val = e.target.value
              const lines = val.split('\n')
              if (lines.length > MAX_LINES) {
                setMessage(lines.slice(0, MAX_LINES).join('\n'))
              } else {
                setMessage(val)
              }
            }}
            placeholder="ກະລຸນາແຈ້ງບັນຫາ ຫຼື ຄຳແນະນຳ"
            rows={3}
            maxLength={300}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid #ddd',
              fontSize: '15px',
              fontFamily: LAO_FONT,
              resize: 'none',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          />
          <div style={{ fontSize: '12px', color: '#65676b', marginTop: '4px' }}>
            {message.length} / 300
          </div>

          <label style={{ display: 'block', fontSize: '15px', fontWeight: '600', color: '#1c1e21', marginTop: '16px', marginBottom: '8px' }}>
            ແນບຮູບ (ສູງສຸດ {MAX_IMAGES} ຮູບ)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
            {imageUpload.previews.map((url, i) => (
              <div
                key={i}
                style={{
                  position: 'relative',
                  width: '80px',
                  height: '80px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#f0f0f0',
                }}
              >
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  type="button"
                  onClick={() => imageUpload.removeImage(i)}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            {imageUpload.previews.length < MAX_IMAGES && (
              <label
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '8px',
                  border: '2px dashed #ccc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: '#fafafa',
                  fontSize: '24px',
                  color: '#999',
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={imageUpload.fileInputRef}
                  onChange={async (e) => {
                    const raw = e.target.files
                    if (raw?.length) {
                      const arr = Array.from(raw)
                      const hasNonImage = arr.some((f) => !f.type.startsWith('image/'))
                      if (hasNonImage) {
                        e.target.value = ''
                        if (imageUpload.fileInputRef.current) imageUpload.fileInputRef.current.value = ''
                        return
                      }
                    }
                    await imageUpload.handleFileChange(e)
                  }}
                  style={{ display: 'none' }}
                />
                +
              </label>
            )}
          </div>

          {submitMessage && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                marginBottom: '16px',
                background: submitMessage.type === 'success' ? '#e7f5ec' : '#fff5f5',
                color: submitMessage.type === 'success' ? '#1a7f37' : '#c92a2a',
                fontSize: '14px',
              }}
            >
              {submitMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#b0c4e0' : '#1877f2',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? <ButtonSpinner /> : 'ສົ່ງລາຍງານ'}
          </button>
        </form>
      </div>
    </main>
  )
}
