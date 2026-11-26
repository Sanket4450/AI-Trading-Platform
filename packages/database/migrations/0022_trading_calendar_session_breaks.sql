-- 0022_trading_calendar_session_breaks
--
-- A trading day can contain more than one live window. The 2024-05-18 DR-site
-- special session traded 09:15-10:00 and 11:30-12:30, so the calendar needs to
-- record the suspension without splitting the day into multiple rows.

ALTER TABLE "trading_calendar"
  ADD COLUMN "session_breaks" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "trading_calendar"
  ADD CONSTRAINT "chk_trading_calendar_session_breaks_2"
  CHECK (jsonb_typeof("session_breaks") = 'array');
