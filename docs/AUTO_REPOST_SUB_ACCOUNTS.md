# Auto Repost For Admin Sub Accounts

This repo now includes a database migration that can auto repost ready-to-sell posts for a restricted account scope.

Scope

- Only posts from `public.cars`
- Only posts with `status = 'recommend'`
- Only visible posts where `is_hidden` is false or null
- Only posts owned by profiles with `is_sub_account = true`
- Only when that sub account belongs to a parent profile whose `profiles.role = 'admin'`
- Only when the post is at least 6 days old

How it works

- The migration adds `public.auto_repost_admin_sub_account_posts()`.
- The function updates `cars.created_at` to `now()`, which matches the current manual repost behavior used in the app.
- If `pg_cron` is enabled, the migration also schedules the function to run every 15 minutes.

Operational notes

- Because the schedule runs every 15 minutes, repost timing is near-real-time, not exact to the second.
- Feed cache may stay warm for a short time after a repost. In this codebase the Redis feed cache TTL is 1 minute, so the visible result may lag briefly after the database update.
- If `pg_cron` is not enabled in Supabase, the migration still creates the function and prints a notice with the schedule command.

Manual test query

```sql
SELECT * FROM public.auto_repost_admin_sub_account_posts();
```

Inspect the schedule

```sql
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'auto-repost-admin-sub-account-posts';
```