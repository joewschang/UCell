-- Additive workflow state; no changes to existing approved publications.
CREATE TABLE learning.daily_greeting_generation (
 greeting_date text PRIMARY KEY CHECK (greeting_date ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' AND greeting_date >= '2026-11-17'),
 status text NOT NULL CHECK (status IN ('RUNNING','FAILED','PUBLISHED','SKIPPED')),
 lease_owner uuid NOT NULL, lease_until timestamptz, attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 3),
 actor_subject text NOT NULL, retry_at timestamptz, error_code text,
 request_id uuid UNIQUE, request_hash text, background_hash text UNIQUE, publication_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
