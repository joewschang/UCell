CREATE TABLE ledger.settlement_replay_metric (
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 settlement_batch_id uuid NOT NULL REFERENCES ledger.settlement_batch(settlement_batch_id),
 snapshot_id uuid NOT NULL REFERENCES ledger.historical_replay_snapshot(snapshot_id),
 action_key text NOT NULL,state_hash text NOT NULL CHECK(length(state_hash)=64),
 total_gpv numeric NOT NULL CHECK(total_gpv>=0),
 total_theory numeric NOT NULL CHECK(total_theory>=0),
 pool_available numeric NOT NULL CHECK(pool_available>=0),
 k_factor numeric NOT NULL CHECK(k_factor BETWEEN 0 AND 1),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(settlement_batch_id,action_key)
);
CREATE INDEX settlement_replay_metric_read ON ledger.settlement_replay_metric(settlement_batch_id,sequence DESC) INCLUDE(recorded_at);
CREATE TRIGGER settlement_replay_metric_immutable BEFORE UPDATE OR DELETE ON ledger.settlement_replay_metric FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
COMMENT ON TABLE ledger.settlement_replay_metric IS 'Append-only Core replay calculation outputs; analytics reads these facts, never calculates K.';
