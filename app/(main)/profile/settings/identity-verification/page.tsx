'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LAO_FONT } from '@/utils/constants'
import { ButtonSpinner } from '@/components/LoadingSpinner'
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon'

const DOCUMENT_TYPES = [
  { value: 'id_card', label: 'ບັດປະຈຳຕົວ' },
  { value: 'driver_license', label: 'ໃບຂັບຂີ່' },
  { value: 'passport', label: 'ໜັງສືຜ່ານແດນ (Passport)' },
] as const

type DocType = typeof DOCUMENT_TYPES[number]['value']

export default function IdentityVerificationPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [documentType, setDocumentType] = useState<DocType>('id_card')
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [documentPreview, setDocumentPreview] = useState<string | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [captureTarget, setCaptureTarget] = useState<'document' | 'selfie' | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none')
  const [checkingStatus, setCheckingStatus] = useState(true)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/verification/status', { credentials: 'include' })
        if (!res.ok) { setCheckingStatus(false); return }
        const data = await res.json()
        if (data.is_verified) {
          setCurrentStatus('approved')
        } else if (data.latest_request) {
          setCurrentStatus(data.latest_request.status)
        }
      } catch {
        // ignore
      } finally {
        setCheckingStatus(false)
      }
    }
    checkStatus()
  }, [])

  const stopCameraStream = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
      setCameraStream(null)
    }
  }

  const closeCamera = () => {
    stopCameraStream()
    setCameraOpen(false)
    setCaptureTarget(null)
    setCameraLoading(false)
    setCameraError(null)
  }

  const openCamera = async (target: 'document' | 'selfie') => {
    try {
      setCameraLoading(true)
      setCameraError(null)
      setCaptureTarget(target)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: target === 'selfie' ? 'user' : { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      setCameraStream(stream)
      setCameraOpen(true)
      setError(null)
    } catch {
      setCameraError('ບໍ່ສາມາດເຂົ້າເຖິງກ້ອງໄດ້ ກະລຸນາອະນຸຍາດການໃຊ້ງານກ້ອງ')
    } finally {
      setCameraLoading(false)
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !captureTarget) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const width = video.videoWidth
    const height = video.videoHeight

    if (!width || !height) return

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, width, height)

    canvas.toBlob((blob) => {
      if (!blob) return
      const timestamp = Date.now()
      const fileName = captureTarget === 'document'
        ? `document-${timestamp}.jpg`
        : `selfie-${timestamp}.jpg`
      const file = new File([blob], fileName, { type: 'image/jpeg' })
      const url = URL.createObjectURL(file)

      if (captureTarget === 'document') {
        if (documentPreview) URL.revokeObjectURL(documentPreview)
        setDocumentFile(file)
        setDocumentPreview(url)
      } else {
        if (selfiePreview) URL.revokeObjectURL(selfiePreview)
        setSelfieFile(file)
        setSelfiePreview(url)
      }

      closeCamera()
    }, 'image/jpeg', 0.92)
  }

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !cameraStream) return
    videoRef.current.srcObject = cameraStream
    void videoRef.current.play().catch(() => {
      setCameraError('ບໍ່ສາມາດເປີດກ້ອງໄດ້')
    })
  }, [cameraOpen, cameraStream])

  useEffect(() => {
    return () => {
      stopCameraStream()
      if (documentPreview) URL.revokeObjectURL(documentPreview)
      if (selfiePreview) URL.revokeObjectURL(selfiePreview)
    }
  }, [documentPreview, selfiePreview])

  const handleSubmit = async () => {
    if (!documentFile || !selfieFile) {
      setError('ກະລຸນາອັບໂຫລດທັງ 2 ຮູບ')
      return
    }
    setSubmitting(true)
    setError(null)

    const formData = new FormData()
    formData.append('document_type', documentType)
    formData.append('document_photo', documentFile)
    formData.append('selfie_photo', selfieFile)

    try {
      const res = await fetch('/api/verification/submit', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'ເກີດຂໍ້ຜິດພາດ ກະລຸນາລອງໃໝ່')
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
              <svg width="48" height="48" viewBox="0 0 24 24" fill="#10b981">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-2 14.5l-4-4 1.41-1.41L10 13.67l6.59-6.58L18 8.5l-8 8z"/>
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
            <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#92400e', margin: 0 }}>ກຳລັງລໍຖ້າກວດສອບ</p>
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
            <p style={{ fontSize: '15px', fontWeight: 'bold', color: '#991b1b', margin: '0 0 4px 0' }}>ຄຳຂໍຖືກປະຕິເສດ</p>
            <p style={{ fontSize: '14px', color: '#b91c1c', margin: 0 }}>ທ່ານສາມາດສົ່ງຄຳຂໍໃໝ່ໄດ້ ກະລຸນາອັບໂຫລດເອກະສານທີ່ຊັດເຈນ</p>
          </div>
        )}

        {/* Form — only if not already approved/pending */}
        {currentStatus !== 'approved' && currentStatus !== 'pending' && !success && (
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
              {documentPreview ? (
                <div style={{ position: 'relative' }}>
                  <img
                    src={documentPreview}
                    alt="Document preview"
                    style={{ width: '100%', borderRadius: '10px', objectFit: 'cover', maxHeight: '200px', border: '2px solid #e5e7eb' }}
                  />
                  <button
                    type="button"
                    onClick={() => openCamera('document')}
                    style={{
                      position: 'absolute', bottom: '10px', right: '10px',
                      background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
                      borderRadius: '8px', padding: '6px 12px', fontSize: '13px',
                      cursor: 'pointer', fontWeight: '600',
                    }}
                  >
                    ປ່ຽນຮູບ
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openCamera('document')}
                  style={{
                    width: '100%', padding: '28px 20px', border: '2px dashed #d1d5db',
                    borderRadius: '10px', background: '#f9fafb', cursor: 'pointer',
                    display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '12px',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <circle cx="8" cy="12" r="2"/>
                    <path d="M14 9h4M14 12h4M14 15h2"/>
                  </svg>
                  <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '600' }}>ຖ່າຍຮູບເອກະສານ</span>
                </button>
              )}
            </div>

            {/* Selfie with Document Upload */}
            <div style={{ marginBottom: '24px' }}>
              {selfiePreview ? (
                <div style={{ position: 'relative' }}>
                  <img
                    src={selfiePreview}
                    alt="Selfie preview"
                    style={{ width: '100%', borderRadius: '10px', objectFit: 'cover', maxHeight: '200px', border: '2px solid #e5e7eb' }}
                  />
                  <button
                    type="button"
                    onClick={() => openCamera('selfie')}
                    style={{
                      position: 'absolute', bottom: '10px', right: '10px',
                      background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
                      borderRadius: '8px', padding: '6px 12px', fontSize: '13px',
                      cursor: 'pointer', fontWeight: '600',
                    }}
                  >
                    ປ່ຽນຮູບ
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openCamera('selfie')}
                  style={{
                    width: '100%', padding: '28px 20px', border: '2px dashed #d1d5db',
                    borderRadius: '10px', background: '#f9fafb', cursor: 'pointer',
                    display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '12px',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <GuestAvatarIcon size={40} stroke="#9ca3af" strokeWidth={1.5} />
                  <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '600' }}>ຖ່າຍຮູບທ່ານຕອນຖືເອກະສານ</span>
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

      {cameraOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.88)',
            zIndex: 3000,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>
              {captureTarget === 'document' ? 'ຖ່າຍຮູບເອກະສານ' : 'ຖ່າຍຮູບທ່ານຕອນຖືເອກະສານ'}
            </span>
            <button
              type="button"
              onClick={closeCamera}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
              aria-label="Close camera"
            >
              ✕
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', maxHeight: '70vh', objectFit: 'cover', borderRadius: '12px', background: '#000' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          <div style={{ padding: '18px 20px 26px' }}>
            {cameraError && (
              <p style={{ color: '#fecaca', fontSize: '13px', textAlign: 'center', margin: '0 0 12px 0' }}>{cameraError}</p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={closeCamera}
                style={{
                  flex: 1,
                  background: '#374151',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  padding: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={cameraLoading}
                style={{
                  flex: 1,
                  background: '#1877f2',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  padding: '12px',
                  fontWeight: 700,
                  cursor: cameraLoading ? 'not-allowed' : 'pointer',
                  opacity: cameraLoading ? 0.7 : 1,
                }}
              >
                {cameraLoading ? 'ກຳລັງເປີດກ້ອງ...' : 'ຖ່າຍຮູບ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
