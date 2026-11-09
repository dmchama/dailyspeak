-- DailySpeak scheduler for Supabase (use this on the Vercel Hobby plan).
-- Supabase calls the app's daily job every 10 minutes; the job is idempotent,
-- so it creates each user's lesson once and sends each reminder once.
--
-- 1. Dashboard → Database → Extensions: enable "pg_cron" and "pg_net".
-- 2. Replace YOUR_APP_URL and YOUR_CRON_SECRET below (same value as CRON_SECRET in Vercel).
-- 3. Run this file in the SQL Editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the secret in Vault instead of writing it into the job definition.
-- (Re-running? This line fails if the secret exists: delete it, or use vault.update_secret instead.)
select vault.create_secret('YOUR_CRON_SECRET', 'dailyspeak_cron_secret');

-- Remove an older copy of the job if you are re-running this file.
select cron.unschedule(jobid) from cron.job where jobname = 'dailyspeak-tick';

select cron.schedule(
  'dailyspeak-tick',
  '*/10 * * * *',
  $$
  select net.http_get(
    url := 'https://YOUR_APP_URL/api/cron/daily',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'dailyspeak_cron_secret')
    ),
    timeout_milliseconds := 290000
  );
  $$
);

-- Check it is running:
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'dailyspeak-tick') order by start_time desc limit 5;
--   select status_code, left(content::text, 200) from net._http_response order by created desc limit 5;
-- The app's own log of each run is in the job_runs table.
