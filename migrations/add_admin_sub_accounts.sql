-- ============================================================
-- Admin Sub Accounts — Migration
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_sub_account BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_admin_id TEXT REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_parent_admin_id
  ON profiles(parent_admin_id)
  WHERE is_sub_account = TRUE;