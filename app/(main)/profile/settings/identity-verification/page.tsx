'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LAO_FONT } from '@/utils/constants'
import { ButtonSpinner } from '@/components/LoadingSpinner'
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/utils/imageCompression'
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile'
import { mergeHeaders } from '@/utils/activeProfile'

const DOCUMENT_TYPES = [
  { value: 'id_card', label: 'ບັດປະຈຳຕົວ' },
  { value: 'driver_license', label: 'ໃບຂັບຂີ່' },
  { value: 'passport', label: 'ໜັງສືຜ່ານແດນ (Passport)' },
] as const

type DocType = typeof DOCUMENT_TYPES[number]['value']

export default function IdentityVerificationPage() {
  const router = useRouter()
  const { activeProfileId, session, sessionReady, startSessionCheck } = useSessionAndProfile()
  const docInputRef = useRef<HTMLInputElement>(null)
  const selfieInputRef = useRef<HTMLInputElement>(null)
  const documentPreviewRef = useRef<string | null>(null)
  const selfiePreviewRef = useRef<string | null>(null)

  const [documentType, setDocumentType] = useState<DocType>('id_card')
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [documentPreview, setDocumentPreview] = useState<string | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [previewModal, setPreviewModal] = useState<{ url: string; target: 'document' | 'selfie' } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none')
  const [rejectionReason, setRejectionReason] = useState<string | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [requiresLogin, setRequiresLogin] = useState(false)

  useEffect(() => {
    startSessionCheck()
  }, [startSessionCheck])

  useEffect(() => {
    const checkStatus = async () => {
      if (!sessionReady) return

      try {
        let currentSession = session
        let accessToken = currentSession?.access_token ?? ''
        if (!accessToken) {
          const refreshed = await supabase.auth.refreshSession()
          accessToken = refreshed.data.session?.access_token ?? ''
          currentSession = refreshed.data.session ?? currentSession
        }

        if (!currentSession?.user?.id) {
          setRequiresLogin(true)
          setError('ກະລຸນາລ໋ອກອິນກ່ອນສົ່ງຄຳຂໍຢືນຢັນຕົວຕົນ')
          setCheckingStatus(false)
          return
        }

        const res = await fetch('/api/verification/status', {
          credentials: 'include',
          headers: mergeHeaders(
            accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
            activeProfileId,
          ),
        })
        if (!res.ok) {
          if (res.status === 401) {
            setRequiresLogin(true)
            setError('ຫມົດເວລາການລ໋ອກອິນ ກະລຸນາລ໋ອກອິນໃໝ່')
          }
          setCheckingStatus(false)
          return
        }

        setRequiresLogin(false)
        setError(null)
        const data = await res.json()
        if (data.is_verified) {
          setCurrentStatus('approved')
        } else if (data.latest_request) {
          setCurrentStatus(data.latest_request.status)
          if (data.latest_request.status === 'rejected') {
            setRejectionReason(data.latest_request.reject_reason ?? null)
          }
        }
      } catch {
        // ignore
      } finally {
        setCheckingStatus(false)
      }
    }
    checkStatus()
  }, [activeProfileId, session, sessionReady])

  useEffect(() => {
    documentPreviewRef.current = documentPreview
  }, [documentPreview])

  useEffect(() => {
    selfiePreviewRef.current = selfiePreview
  }, [selfiePreview])

  useEffect(() => {
    return () => {
      if (documentPreviewRef.current) URL.revokeObjectURL(documentPreviewRef.current)
      if (selfiePreviewRef.current) URL.revokeObjectURL(selfiePreviewRef.current)
    }
  }, [])

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (documentPreviewRef.current) URL.revokeObjectURL(documentPreviewRef.current)
    const url = URL.createObjectURL(file)
    setDocumentFile(file)
    setDocumentPreview(url)
    setError(null)
  }

  const handleSelfieSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (selfiePreviewRef.current) URL.revokeObjectURL(selfiePreviewRef.current)
    const url = URL.createObjectURL(file)
    setSelfieFile(file)
    setSelfiePreview(url)
    setError(null)
  }

  const handleReselect = (target: 'document' | 'selfie') => {
    setPreviewModal(null)
    if (target === 'document') {
      docInputRef.current?.click()
      return
    }
    selfieInputRef.current?.click()
  }

  const handleSubmit = async () => {
    if (requiresLogin) {
      setError('ກະລຸນາລ໋ອກອິນກ່ອນສົ່ງຄຳຂໍຢືນຢັນຕົວຕົນ')
      return
    }

    if (!documentFile || !selfieFile) {
      setError('ກະລຸນາອັບໂຫລດທັງ 2 ຮູບ')
      return
    }
    setSubmitting(true)
    setError(null)

    // Compress images client-side first (same as create-post)
    // This converts HEIC/large iPhone photos to WebP and keeps size well under server limits
    let compressedDoc: File
    let compressedSelfie: File
    try {
      ;[compressedDoc, compressedSelfie] = await Promise.all([
        compressImage(documentFile, 1600, 0.85),
        compressImage(selfieFile, 1600, 0.85),
      ])
    } catch {
      setError('ເກີດຂໍ້ຜິດພາດໃນການປະມວນຜົນຮູບ ກະລຸນາລອງໃໝ່')
      setSubmitting(false)
      return
    }

    const formData = new FormData()
    formData.append('document_type', documentType)
    formData.append('document_photo', compressedDoc)
    formData.append('selfie_photo', compressedSelfie)

    try {
      let { data: { session } } = await supabase.auth.getSession()
      let accessToken = session?.access_token ?? ''

      if (!accessToken) {
        const refreshed = await supabase.auth.refreshSession()
        accessToken = refreshed.data.session?.access_token ?? ''
      }

      const res = await fetch('/api/verification/submit', {
        method: 'POST',
        credentials: 'include',
        headers: mergeHeaders(
          accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          activeProfileId,
        ),
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) {
          setRequiresLogin(true)
          setError('ຫມົດເວລາການລ໋ອກອິນ ກະລຸນາລ໋ອກອິນໃໝ່')
          return
        }
        // Translate known server errors to Lao
        const serverErr: string = data.error ?? ''
        if (serverErr.includes('pending')) {
          setError('ທ່ານມີຄຳຂໍລໍຖ້າກວດສອບຢູ່ແລ້ວ ກະລຸນາລໍຖ້າ')
        } else if (serverErr.includes('Already verified') || serverErr.includes('approved')) {
          setError('ບັນຊີຂອງທ່ານໄດ້ຮັບການຢືນຢັນແລ້ວ')
        } else if (serverErr.includes('file type') || serverErr.includes('ປະເພດໄຟລ')) {
          setError('ປະເພດຮູບບໍ່ຖືກຕ້ອງ ກະລຸນາໃຊ້ຮູບພາບ')
        } else if (serverErr.includes('too large') || serverErr.includes('ຂະໜາດໃຫ')) {
          setError('ຮູບມີຂະໜາດໃຫ່ຍເກີນໄປ (ສູງສຸດ 10MB)')
        } else if (serverErr.includes('upload')) {
          setError('ອັບໂຫລດຮູບບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່')
        } else {
          setError('ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່')
        }
      } else {
        setSuccess(true)
        setCurrentStatus('pending')
      }
    } catch {
      setError('ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່')
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingStatus) {
    return (
      <main style={{ maxWidth: '600px', margin: '0 auto', background: '#ffffff', minHeight: '100vh', fontFamily: LAO_FONT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ButtonSpinner />
      </main>
    )
  }

  return (
    <main style={{
      maxWidth: '600px',
      margin: '0 auto',
      background: '#ffffff',
      backgroundColor: '#ffffff',
      minHeight: '100vh',
      fontFamily: LAO_FONT,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 15px 10px 15px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'sticky',
        top: 0,
        background: '#ffffff',
        backgroundColor: '#ffffff',
        zIndex: 100,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1c1e21', padding: '0', position: 'absolute', left: '15px'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1c1e21' }}>ຢືນຢັນຕົວຕົນ</h1>
      </div>

      <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>

        {/* Already verified */}
        {currentStatus === 'approved' && (
          <div style={{
            background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '12px',
            padding: '20px', textAlign: 'center', marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <svg width="48" height="48" viewBox="0 0 24 24">
                <g fill="#2d9bf0">
                  <circle cx="12" cy="12" r="8.2"/>
                  <circle cx="12" cy="4.7" r="3.5"/>
                  <circle cx="17.2" cy="6.8" r="3.5"/>
                  <circle cx="19.3" cy="12" r="3.5"/>
                  <circle cx="17.2" cy="17.2" r="3.5"/>
                  <circle cx="12" cy="19.3" r="3.5"/>
                  <circle cx="6.8" cy="17.2" r="3.5"/>
                  <circle cx="4.7" cy="12" r="3.5"/>
                  <circle cx="6.8" cy="6.8" r="3.5"/>
                </g>
                <path d="M7.1 12.9L10.3 16.1L17.1 9.2L15.5 7.6L10.3 12.8L8.7 11.3L7.1 12.9Z" fill="white"/>
              </svg>
            </div>
            <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#065f46', margin: 0 }}>ຢືນຢັນຕົວຕົນສຳເລັດແລ້ວ</p>
            <p style={{ fontSize: '14px', color: '#047857', marginTop: '8px' }}>ບັນຊີຂອງທ່ານໄດ້ຮັບການຢືນຢັນຕົວຕົນແລ້ວ</p>
          </div>
        )}

        {/* Pending */}
        {currentStatus === 'pending' && !success && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px',
            padding: '20px', textAlign: 'center', marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#92400e', margin: 0 }}>ກຳລັງລໍຖ້າການກວດສອບ</p>
            <p style={{ fontSize: '14px', color: '#b45309', marginTop: '8px' }}>ທີມງານກຳລັງກວດສອບເອກະສານຂອງທ່ານ ກະລຸນາລໍຖ້າ</p>
          </div>
        )}

        {/* Success just submitted */}
        {success && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px',
            padding: '20px', textAlign: 'center', marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#065f46', margin: 0 }}>ສົ່ງຄຳຂໍສຳເລັດ!</p>
            <p style={{ fontSize: '14px', color: '#047857', marginTop: '8px' }}>ທີມງານຈະກວດສອບຂໍ້ມູນຂອງທ່ານ ກຳນົດ 1-3 ວັນທຳການ</p>
          </div>
        )}

        {/* Rejected — allow resubmit */}
        {currentStatus === 'rejected' && !success && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px',
            padding: '16px', marginBottom: '20px'
          }}>
            <p style={{ fontSize: '15px', fontWeight: 'bold', color: '#991b1b', margin: '0 0 8px 0' }}>ຄຳຂໍຖືກປະຕິເສດ</p>
            {rejectionReason && (
              <div style={{
                background: '#ffffff', border: '1px solid #fecaca', borderRadius: '8px',
                padding: '12px', marginBottom: '12px'
              }}>
                <p style={{ fontSize: '13px', color: '#7f1d1d', margin: 0 }}>
                  <strong>ເຫດຜົນ:</strong> {rejectionReason}
                </p>
              </div>
            )}
            <p style={{ fontSize: '14px', color: '#b91c1c', margin: 0 }}>ທ່ານສາມາດສົ່ງຄຳຂໍໃໝ່ໄດ້ ກະລຸນາອັບໂຫລດເອກະສານທີ່ຊັດເຈນ</p>
          </div>
        )}

        {/* Session missing: show clear message instead of blank screen */}
        {requiresLogin && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '20px',
            textAlign: 'center',
          }}>
            <p style={{ margin: 0, color: '#991b1b', fontSize: '15px', fontWeight: 700 }}>
              ກະລຸນາລ໋ອກອິນກ່ອນ
            </p>
            <p style={{ margin: '8px 0 14px 0', color: '#b91c1c', fontSize: '14px' }}>
              ເຊສຊັນຂອງທ່ານໝົດອາຍຸ ຫຼື ບໍ່ໄດ້ລ໋ອກອິນ
            </p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              style={{
                background: '#1877f2',
                color: '#fff',
                border: 'none',
                borderRadius: '20px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ໄປໜ້າລ໋ອກອິນ
            </button>
          </div>
        )}

        {/* Form — only if not already approved/pending */}
        {currentStatus !== 'approved' && currentStatus !== 'pending' && !success && !requiresLogin && (
          <>
            {/* Document Type */}
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '15px', fontWeight: '700', color: '#1c1e21', marginBottom: '12px' }}>
                ເລືອກປະເພດເອກະສານ
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {DOCUMENT_TYPES.map((type) => (
                  <label
                    key={type.value}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', borderRadius: '10px',
                      border: `2px solid ${documentType === type.value ? '#1877f2' : '#e5e7eb'}`,
                      background: documentType === type.value ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="document_type"
                      value={type.value}
                      checked={documentType === type.value}
                      onChange={() => setDocumentType(type.value)}
                      style={{ accentColor: '#1877f2', width: '18px', height: '18px' }}
                    />
                    <span style={{ fontSize: '15px', fontWeight: '600', color: '#1c1e21' }}>
                      {type.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Document Photo Upload */}
            <div style={{ marginBottom: '24px' }}>
              <input
                ref={docInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                style={{ display: 'none' }}
                onChange={handleDocumentSelect}
              />
              {documentPreview ? (
                <div style={{ position: 'relative' }}>
                  <img
                    src={documentPreview}
                    alt="Document preview"
                    onClick={() => setPreviewModal({ url: documentPreview, target: 'document' })}
                    style={{ width: '100%', borderRadius: '10px', objectFit: 'cover', maxHeight: '200px', border: '2px solid #e5e7eb', cursor: 'pointer' }}
                  />
                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    style={{
                      position: 'absolute', bottom: '10px', right: '10px',
                      background: '#1877f2', color: '#fff', border: 'none',
                      borderRadius: '20px', padding: '6px 12px', fontSize: '13px',
                      cursor: 'pointer', fontWeight: '600',
                    }}
                  >
                    ເລືອກຮູບໃໝ່
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  style={{
                    width: '100%', padding: '28px 20px', border: '2px dashed #d1d5db',
                    borderRadius: '10px', background: '#f9fafb',
                    display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '12px',
                    transition: 'border-color 0.15s ease',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <circle cx="8" cy="12" r="2"/>
                    <path d="M14 9h4M14 12h4M14 15h2"/>
                  </svg>
                  <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '600' }}>ອັບໂຫລດຮູບເອກະສານ</span>
                </button>
              )}
            </div>

            {/* Selfie with Document Upload */}
            <div style={{ marginBottom: '24px' }}>
              <input
                ref={selfieInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                style={{ display: 'none' }}
                onChange={handleSelfieSelect}
              />
              {selfiePreview ? (
                <div style={{ position: 'relative' }}>
                  <img
                    src={selfiePreview}
                    alt="Selfie preview"
                    onClick={() => setPreviewModal({ url: selfiePreview, target: 'selfie' })}
                    style={{ width: '100%', borderRadius: '10px', objectFit: 'cover', maxHeight: '200px', border: '2px solid #e5e7eb', cursor: 'pointer' }}
                  />
                  <button
                    type="button"
                    onClick={() => selfieInputRef.current?.click()}
                    style={{
                      position: 'absolute', bottom: '10px', right: '10px',
                      background: '#1877f2', color: '#fff', border: 'none',
                      borderRadius: '20px', padding: '6px 12px', fontSize: '13px',
                      cursor: 'pointer', fontWeight: '600',
                    }}
                  >
                    ເລືອກຮູບໃໝ່
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => selfieInputRef.current?.click()}
                  style={{
                    width: '100%', padding: '28px 20px', border: '2px dashed #d1d5db',
                    borderRadius: '10px', background: '#f9fafb',
                    display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '12px',
                    transition: 'border-color 0.15s ease',
                    cursor: 'pointer',
                  }}
                >
                  <GuestAvatarIcon size={40} stroke="#9ca3af" strokeWidth={1.5} />
                  <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '600' }}>ອັບໂຫລດຮູບຖ່າຍຕອນຖືເອກະສານ</span>
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px',
                padding: '12px 16px', marginBottom: '20px',
              }}>
                <p style={{ margin: 0, color: '#dc2626', fontSize: '14px' }}>{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !documentFile || !selfieFile}
              style={{
                width: '100%', padding: '14px', background: (!documentFile || !selfieFile || submitting) ? '#d1d5db' : '#1877f2',
                border: 'none', borderRadius: '10px', color: '#fff', fontSize: '16px',
                fontWeight: 'bold', cursor: (!documentFile || !selfieFile || submitting) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'background 0.15s ease',
                marginBottom: '40px',
              }}
            >
              {submitting ? (
                <>
                  <ButtonSpinner />
                  <span>ກຳລັງສົ່ງ...</span>
                </>
              ) : (
                'ສົ່ງຄຳຂໍຢືນຢັນຕົວຕົນ'
              )}
            </button>

          </>
        )}
      </div>

      {previewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.86)',
            zIndex: 3100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setPreviewModal(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewModal(null)}
            aria-label="Close preview"
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.18)',
              color: '#ffffff',
              fontSize: '22px',
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
          <img
            src={previewModal.url}
            alt="Captured preview"
            style={{ maxWidth: '92vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: '12px' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => handleReselect(previewModal.target)}
            style={{
              marginTop: '14px',
              background: '#1877f2',
              color: '#ffffff',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 14px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ເລືອກຮູບໃໝ່
          </button>
        </div>
      )}
    </main>
  )
}
