-- ============================================================
-- Identity Verification System — Migration
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Add is_verified column to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create verification_requests table
CREATE TABLE IF NOT EXISTS verification_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type   TEXT        NOT NULL CHECK (document_type IN ('id_card', 'driver_license', 'passport')),
  document_url    TEXT        NOT NULL,
  selfie_url      TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  reject_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     TEXT        REFERENCES profiles(id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id
  ON verification_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_verification_requests_status
  ON verification_requests(status);

-- 4. Enable RLS
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

-- 5. Users can read only their own requests
CREATE POLICY "Users can view own verification requests"
  ON verification_requests FOR SELECT
  USING (auth.uid()::text = user_id);

-- 6. Users can insert their own requests
CREATE POLICY "Users can create verification requests"
  ON verification_requests FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Note: UPDATE/DELETE by admins is handled via service_role key (bypasses RLS)
