'use client'
import { useState, useEffect } from 'react';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';

type VerificationRequest = {
  id: string;
  user_id: string;
  document_type: 'id_card' | 'driver_license' | 'passport';
  document_url: string;
  selfie_url: string;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  profiles: { username: string; avatar_url: string | null } | null;
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  id_card: 'ບັດປະຈຳຕົວ',
  driver_license: 'ໃບຂັບຂີ່',
  passport: 'ໜັງສືຜ່ານແດນ',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AdminVerificationPage() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/verification?status=${statusFilter}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('ຢືນຢັນການອະນຸມັດ?')) return;
    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/verification/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectTargetId) return;
    setProcessing(rejectTargetId);
    try {
      const res = await fetch(`/api/admin/verification/${rejectTargetId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reject_reason: rejectReason }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== rejectTargetId));
        setRejectTargetId(null);
        setRejectReason('');
      }
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#111' }}>
        Identity Verification
      </h1>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '8px 20px',
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              background: statusFilter === s ? '#1877f2' : '#e4e6eb',
              color: statusFilter === s ? '#fff' : '#4b4f56',
              transition: '0.2s',
            }}
          >
            {s === 'pending' ? 'Pending' : s === 'approved' ? 'Approved' : 'Rejected'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>Loading...</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#888', fontSize: '16px' }}>
          No {statusFilter} requests
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {requests.map((req) => (
            <div
              key={req.id}
              style={{
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #e4e6eb',
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              {/* Card Header */}
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f0f2f5' }}>
                {req.profiles?.avatar_url ? (
                  <img
                    src={req.profiles.avatar_url}
                    alt=""
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#111' }}>
                    {req.profiles?.username || req.user_id}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>
                    {DOCUMENT_TYPE_LABELS[req.document_type] || req.document_type} · {formatDate(req.created_at)}
                  </div>
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
                  background: req.status === 'pending' ? '#fef3c7' : req.status === 'approved' ? '#d1fae5' : '#fee2e2',
                  color: req.status === 'pending' ? '#92400e' : req.status === 'approved' ? '#065f46' : '#991b1b',
                }}>
                  {req.status}
                </span>
              </div>

              {/* Images */}
              <div style={{ padding: '16px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '8px' }}>
                    ຮູບ 1: ເອກະສານ
                  </p>
                  <img
                    src={req.document_url}
                    alt="Document"
                    onClick={() => setLightboxUrl(req.document_url)}
                    style={{
                      width: '100%', maxHeight: '200px', objectFit: 'cover',
                      borderRadius: '8px', border: '1px solid #e5e7eb',
                      cursor: 'pointer',
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '8px' }}>
                    ຮູບ 2: ຖ່າຍໜ້າຕົວເອງພ້ອມເອກະສານ
                  </p>
                  <img
                    src={req.selfie_url}
                    alt="Selfie with document"
                    onClick={() => setLightboxUrl(req.selfie_url)}
                    style={{
                      width: '100%', maxHeight: '200px', objectFit: 'cover',
                      borderRadius: '8px', border: '1px solid #e5e7eb',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              </div>

              {/* Reject reason display */}
              {req.reject_reason && (
                <div style={{ padding: '0 20px 12px', fontSize: '14px', color: '#dc2626' }}>
                  <strong>Reason:</strong> {req.reject_reason}
                </div>
              )}

              {/* Actions */}
              {req.status === 'pending' && (
                <div style={{ padding: '12px 20px 20px', display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={processing === req.id}
                    style={{
                      flex: 1, padding: '10px', background: '#10b981', color: '#fff',
                      border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '15px',
                      cursor: processing === req.id ? 'not-allowed' : 'pointer',
                      opacity: processing === req.id ? 0.6 : 1,
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => setRejectTargetId(req.id)}
                    disabled={processing === req.id}
                    style={{
                      flex: 1, padding: '10px', background: '#ef4444', color: '#fff',
                      border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '15px',
                      cursor: processing === req.id ? 'not-allowed' : 'pointer',
                      opacity: processing === req.id ? 0.6 : 1,
                    }}
                  >
                    ✗ Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectTargetId && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}
          onClick={() => { setRejectTargetId(null); setRejectReason(''); }}
        >
          <div
            style={{
              background: '#fff', borderRadius: '12px', padding: '24px',
              maxWidth: '400px', width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#111' }}>
              ເຫດຜົນທີ່ປະຕິເສດ (ທາງເລືອກ)
            </h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="ລະບຸເຫດຜົນ..."
              rows={3}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                border: '1px solid #d1d5db', fontSize: '14px', resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button
                onClick={() => { setRejectTargetId(null); setRejectReason(''); }}
                style={{
                  flex: 1, padding: '10px', background: '#e4e6eb', border: 'none',
                  borderRadius: '8px', fontWeight: '700', cursor: 'pointer', color: '#1c1e21',
                }}
              >
                ຍົກເລີກ
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!!processing}
                style={{
                  flex: 1, padding: '10px', background: '#ef4444', border: 'none',
                  borderRadius: '8px', fontWeight: '700', cursor: 'pointer', color: '#fff',
                  opacity: processing ? 0.6 : 1,
                }}
              >
                ຢືນຢັນ Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
            zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Full size"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'absolute', top: '20px', right: '20px',
              background: 'rgba(255,255,255,0.2)', border: 'none',
              borderRadius: '50%', width: '40px', height: '40px',
              cursor: 'pointer', color: '#fff', fontSize: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
