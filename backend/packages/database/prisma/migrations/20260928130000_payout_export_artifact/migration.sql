CREATE TABLE ledger.payout_export_artifact (
 payout_export_artifact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 payout_batch_id uuid NOT NULL REFERENCES ledger.payout_batch(payout_batch_id),
 export_reference text NOT NULL UNIQUE,
 adapter_code text NOT NULL,
 format_version text NOT NULL,
 content_hash char(64) NOT NULL,
 payload_snapshot jsonb NOT NULL,
 generated_by_actor text NOT NULL,
 generated_at timestamptz(6) NOT NULL DEFAULT now(),
 UNIQUE(payout_batch_id,format_version)
);