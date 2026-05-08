-- Migration: Add short_id column to whatsapp_click_logs
-- Purpose: Store post short_id directly for easier querying on admin dashboard

-- Add short_id column if it doesn't exist
ALTER TABLE whatsapp_click_logs 
ADD COLUMN short_id TEXT NULL;

-- Update existing records with short_id from posts table
UPDATE whatsapp_click_logs wcl
SET short_id = p.short_id
FROM posts p
WHERE wcl.post_id = p.id AND wcl.short_id IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_click_logs_short_id ON whatsapp_click_logs(short_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_click_logs_target_profile ON whatsapp_click_logs(target_profile_id, created_at);
