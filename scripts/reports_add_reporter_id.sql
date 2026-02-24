-- Add reporter_id to reports table so admin Post Report page can show reporter profile (avatar, username).
-- Run this once if your reports table was created without reporter_id.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);

COMMENT ON COLUMN public.reports.reporter_id IS 'User ID of the reporter; used to show avatar and username on admin Post Report page.';
