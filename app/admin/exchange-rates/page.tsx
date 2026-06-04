'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LAO_FONT } from '@/utils/constants';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { normalizeExchangeRates } from '@/utils/exchangeRates';

type ExchangeRateRow = {
  id: number;
  lak_to_thb: number;
  lak_to_usd: number;
  thb_to_lak: number;
  thb_to_usd: number;
  usd_to_lak: number;
  usd_to_thb: number;
  note?: string | null;
  updated_by?: string | null;
  updated_at: string;
};

function formatDateTime(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminExchangeRatesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState<ExchangeRateRow[]>([]);

  const [lakToThbInput, setLakToThbInput] = useState('');
  const [lakToUsdInput, setLakToUsdInput] = useState('');
  const [thbToLakInput, setThbToLakInput] = useState('');
  const [thbToUsdInput, setThbToUsdInput] = useState('');
  const [usdToLakInput, setUsdToLakInput] = useState('');
  const [usdToThbInput, setUsdToThbInput] = useState('');
  const [note, setNote] = useState('');

  const latest = history[0] || null;

  const loadRates = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/exchange-rates', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to load exchange rates');
      }

      const rows = Array.isArray(json?.history) ? (json.history as ExchangeRateRow[]) : [];
      setHistory(rows);

      if (rows.length > 0) {
        const normalized = normalizeExchangeRates(rows[0]);
        setLakToThbInput(String(normalized.lak_to_thb));
        setLakToUsdInput(String(normalized.lak_to_usd));
        setThbToLakInput(String(normalized.thb_to_lak));
        setThbToUsdInput(String(normalized.thb_to_usd));
        setUsdToLakInput(String(normalized.usd_to_lak));
        setUsdToThbInput(String(normalized.usd_to_thb));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exchange rates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  const canSubmit = useMemo(() => {
    const lakToThb = Number(lakToThbInput);
    const lakToUsd = Number(lakToUsdInput);
    const thb = Number(thbToLakInput);
    const thbToUsd = Number(thbToUsdInput);
    const usd = Number(usdToLakInput);

    const usdToThb = Number(usdToThbInput);
    if (!Number.isFinite(lakToThb) || lakToThb <= 0) return false;
    if (!Number.isFinite(lakToUsd) || lakToUsd <= 0) return false;
    if (!Number.isFinite(thb) || thb <= 0) return false;
    if (!Number.isFinite(thbToUsd) || thbToUsd <= 0) return false;
    if (!Number.isFinite(usd) || usd <= 0) return false;
    if (!Number.isFinite(usdToThb) || usdToThb <= 0) return false;
    return !saving;
  }, [saving, lakToThbInput, lakToUsdInput, thbToLakInput, thbToUsdInput, usdToLakInput, usdToThbInput]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        lak_to_thb: Number(lakToThbInput),
        lak_to_usd: Number(lakToUsdInput),
        thb_to_lak: Number(thbToLakInput),
        thb_to_usd: Number(thbToUsdInput),
        usd_to_lak: Number(usdToLakInput),
        usd_to_thb: Number(usdToThbInput),
        note: note.trim() || null,
      };

      const res = await fetch('/api/admin/exchange-rates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to update exchange rate');
      }

      setSuccess(typeof json?.message === 'string' ? json.message : 'Updated exchange rate successfully');
      setNote('');
      await loadRates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update exchange rate');
    } finally {
      setSaving(false);
    }
  }, [canSubmit, loadRates, note, lakToThbInput, lakToUsdInput, thbToLakInput, thbToUsdInput, usdToLakInput, usdToThbInput]);

  return (
    <main
      style={{
        maxWidth: '980px',
        margin: '0 auto',
        fontFamily: LAO_FONT,
        color: '#0f172a',
      }}
    >
      <div style={{ marginBottom: '18px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>Exchange Rates</h1>
        <p style={{ color: '#475569', margin: 0 }}>
          ອັບເດດອັດຕາແລກປ່ຽນເພື່ອໃຫ້ລະບົບຄຳນວນອັດຕາແລກປ່ຽນໂດຍປະມານໃໝ່ທຸກໂພສອັດຕະໂນມັດ
        </p>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <section
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '20px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(200px, 1fr))', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 600 }}>
                1 ₭ = ? ฿
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={lakToThbInput}
                  onChange={(e) => setLakToThbInput(e.target.value)}
                  placeholder="0.001176"
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '15px',
                    color: '#111827',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 600 }}>
                1 ₭ = ? $
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={lakToUsdInput}
                  onChange={(e) => setLakToUsdInput(e.target.value)}
                  placeholder="0.000045"
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '15px',
                    color: '#111827',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 600 }}>
                1 ฿ = ? ₭
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={thbToLakInput}
                  onChange={(e) => setThbToLakInput(e.target.value)}
                  placeholder="850"
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '15px',
                    color: '#111827',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 600 }}>
                1 ฿ = ? $
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={thbToUsdInput}
                  onChange={(e) => setThbToUsdInput(e.target.value)}
                  placeholder="0.030303"
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '15px',
                    color: '#111827',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 600 }}>
                1 $ = ? ₭
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={usdToLakInput}
                  onChange={(e) => setUsdToLakInput(e.target.value)}
                  placeholder="22000"
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '15px',
                    color: '#111827',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 600 }}>
                1 $ = ? ฿
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={usdToThbInput}
                  onChange={(e) => setUsdToThbInput(e.target.value)}
                  placeholder="32"
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '15px',
                    color: '#111827',
                  }}
                />
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 600, marginTop: '14px' }}>
              Note (optional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="ຕົວຢ່າງ: ອັບເດດຕາມຕະຫຼາດ 10:30"
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '15px',
                  color: '#111827',
                  resize: 'vertical',
                }}
              />
            </label>

            {error ? (
              <div style={{ marginTop: '12px', color: '#b91c1c', fontSize: '14px' }}>{error}</div>
            ) : null}
            {success ? (
              <div style={{ marginTop: '12px', color: '#065f46', fontSize: '14px' }}>{success}</div>
            ) : null}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  border: 'none',
                  background: canSubmit ? '#0f766e' : '#94a3b8',
                  color: '#fff',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '14px',
                  padding: '10px 16px',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                }}
              >
                {saving ? 'Saving...' : 'Save Exchange Rate'}
              </button>

              <button
                type="button"
                onClick={loadRates}
                style={{
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#0f172a',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '14px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                }}
              >
                Refresh
              </button>
            </div>
          </section>

          <section
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '20px',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>Latest Snapshot</h2>

            {latest ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(170px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>1 ₭</div>
                  <div style={{ fontWeight: 800, fontSize: '18px' }}>{Number(latest.lak_to_thb).toLocaleString('en-US')} ฿</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>1 ₭</div>
                  <div style={{ fontWeight: 800, fontSize: '18px' }}>{Number(latest.lak_to_usd).toLocaleString('en-US')} $</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>1 ฿</div>
                  <div style={{ fontWeight: 800, fontSize: '18px' }}>{Number(latest.thb_to_lak).toLocaleString('en-US')} ₭</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>1 ฿</div>
                  <div style={{ fontWeight: 800, fontSize: '18px' }}>{Number(latest.thb_to_usd).toLocaleString('en-US')} $</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>1 $</div>
                  <div style={{ fontWeight: 800, fontSize: '18px' }}>{Number(latest.usd_to_lak).toLocaleString('en-US')} ₭</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>1 $</div>
                  <div style={{ fontWeight: 800, fontSize: '18px' }}>{Number(latest.usd_to_thb).toLocaleString('en-US')} ฿</div>
                </div>
                </div>
                <div style={{ marginBottom: '14px', fontSize: '13px', color: '#475569' }}>
                  Updated At: {formatDateTime(latest.updated_at)}
                </div>
              </>
            ) : (
              <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '12px' }}>
                No exchange rate history found yet.
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px' }}>Updated At</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px' }}>1 ₭ = ฿</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px' }}>1 ₭ = $</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px' }}>1 ฿ = ₭</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px' }}>1 ฿ = $</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px' }}>1 $ = ₭</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px' }}>1 $ = ฿</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '13px' }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #eef2f7' }}>
                      <td style={{ padding: '10px', fontSize: '14px' }}>{formatDateTime(row.updated_at)}</td>
                      <td style={{ padding: '10px', fontSize: '14px', fontWeight: 600 }}>
                        {Number(row.lak_to_thb).toLocaleString('en-US')}
                      </td>
                      <td style={{ padding: '10px', fontSize: '14px', fontWeight: 600 }}>
                        {Number(row.lak_to_usd).toLocaleString('en-US')}
                      </td>
                      <td style={{ padding: '10px', fontSize: '14px', fontWeight: 600 }}>
                        {Number(row.thb_to_lak).toLocaleString('en-US')}
                      </td>
                      <td style={{ padding: '10px', fontSize: '14px', fontWeight: 600 }}>
                        {Number(row.thb_to_usd).toLocaleString('en-US')}
                      </td>
                      <td style={{ padding: '10px', fontSize: '14px', fontWeight: 600 }}>
                        {Number(row.usd_to_lak).toLocaleString('en-US')}
                      </td>
                      <td style={{ padding: '10px', fontSize: '14px', fontWeight: 600 }}>
                        {Number(row.usd_to_thb).toLocaleString('en-US')}
                      </td>
                      <td style={{ padding: '10px', fontSize: '14px', color: '#475569' }}>{row.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
