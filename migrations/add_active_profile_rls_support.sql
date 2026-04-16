-- ============================================================
-- Active profile RLS support for profile-only sub accounts
-- Allows the authenticated parent account to act on behalf of a child profile
-- when user_id points to a profile whose parent_admin_id matches auth.uid().
-- ============================================================

-- verification_requests
DROP POLICY IF EXISTS "Users can view own verification requests" ON verification_requests;
CREATE POLICY "Users can view own verification requests"
  ON verification_requests FOR SELECT
  USING (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = verification_requests.user_id
        AND profiles.parent_admin_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can create verification requests" ON verification_requests;
CREATE POLICY "Users can create verification requests"
  ON verification_requests FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = verification_requests.user_id
        AND profiles.parent_admin_id = auth.uid()::text
    )
  );

-- user_problem_reports
DROP POLICY IF EXISTS "Users can insert own problem report" ON public.user_problem_reports;
CREATE POLICY "Users can insert own problem report"
  ON public.user_problem_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = user_id::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = public.user_problem_reports.user_id::text
        AND public.profiles.parent_admin_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can select own problem reports" ON public.user_problem_reports;
CREATE POLICY "Users can select own problem reports"
  ON public.user_problem_reports
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = user_id::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = public.user_problem_reports.user_id::text
        AND public.profiles.parent_admin_id = auth.uid()::text
    )
  );

-- search_logs guest adoption
DROP POLICY IF EXISTS "Authenticated can adopt guest logs" ON public.search_logs;
CREATE POLICY "Authenticated can adopt guest logs"
  ON public.search_logs
  FOR UPDATE
  TO authenticated
  USING (
    user_id IS NULL
    OR user_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = public.search_logs.user_id::text
        AND public.profiles.parent_admin_id = auth.uid()::text
    )
  )
  WITH CHECK (
    user_id::text = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = public.search_logs.user_id::text
        AND public.profiles.parent_admin_id = auth.uid()::text
    )
  );