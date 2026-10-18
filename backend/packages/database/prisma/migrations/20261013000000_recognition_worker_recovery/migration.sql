ALTER TABLE subscription.monthly_recognition_schedule
  ADD COLUMN worker_failure_count integer NOT NULL DEFAULT 0 CHECK (worker_failure_count >= 0),
  ADD COLUMN worker_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN worker_next_attempt_at timestamptz(6),
  ADD COLUMN worker_last_failed_at timestamptz(6),
  ADD COLUMN worker_last_error_code text,
  ADD COLUMN worker_last_trace_id uuid;

CREATE INDEX monthly_recognition_worker_ready_idx
  ON subscription.monthly_recognition_schedule (due_at, recognition_id)
  WHERE status IN ('SCHEDULED', 'DUE') AND worker_blocked = false;
