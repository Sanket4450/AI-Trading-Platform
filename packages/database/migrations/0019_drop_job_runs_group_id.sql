-- `group_id` was never read: it was written once per instrument fetch as a fresh UUID and only
-- rendered on the job detail page. No query, rollup or cancellation used it, so it is removed
-- rather than kept as unused schema. The partial index on the column drops with it.

ALTER TABLE job_runs DROP COLUMN IF EXISTS group_id;
