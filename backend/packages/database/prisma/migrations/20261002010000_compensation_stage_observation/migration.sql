-- Operational read-model observations, never a compensation ledger or invented
-- historical stage-entry time. Refresh callers supply the authoritative read cutoff.
CREATE TABLE integration.compensation_stage_observation (
 observation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 period_start timestamptz NOT NULL,
 period_end timestamptz NOT NULL,
 rule_version_code text NOT NULL CHECK(length(rule_version_code) BETWEEN 1 AND 100),
 revision integer NOT NULL CHECK(revision>0),
 previous_stage text,
 stage text NOT NULL CHECK(stage IN ('OPEN','PRECHECK','READY_TO_CLOSE','SOFT_CLOSED','SETTLING','RECONCILING','AWARD_FINALIZED','MATURING','PAYABLE_READY','PAYMENT_REVIEW','EXPORTED','BANK_RECONCILING','FINANCIALLY_RECONCILED','CLOSED','BLOCKED')),
 source_as_of timestamptz NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 evidence_hash text NOT NULL CHECK(evidence_hash ~ '^[a-f0-9]{64}$'),
 CHECK(period_end>period_start),
 CHECK(source_as_of<=observed_at),
 UNIQUE(period_start,period_end,rule_version_code,revision)
);
CREATE TRIGGER compensation_stage_observation_immutable BEFORE UPDATE OR DELETE
 ON integration.compensation_stage_observation FOR EACH ROW
 EXECUTE FUNCTION public.ucell_prevent_mutation();
-- Mutable projection watermark; keeps unchanged refreshes from admitting a
-- subsequently arriving older read without rewriting any stage evidence.
CREATE TABLE integration.compensation_stage_watermark (
 period_start timestamptz NOT NULL,period_end timestamptz NOT NULL,
 rule_version_code text NOT NULL,source_as_of timestamptz NOT NULL,
 PRIMARY KEY(period_start,period_end,rule_version_code)
);

CREATE FUNCTION integration.ucell_observe_compensation_stage(
 p_start timestamptz,p_end timestamptz,p_rule text,p_stage text,p_source_as_of timestamptz,p_hash text
) RETURNS SETOF integration.compensation_stage_observation LANGUAGE plpgsql AS $$
DECLARE prior integration.compensation_stage_observation; watermark timestamptz;
BEGIN
 IF p_end<=p_start OR p_rule IS NULL OR length(p_rule) NOT BETWEEN 1 AND 100
  OR p_source_as_of IS NULL OR p_source_as_of>clock_timestamp()
  OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$'
  OR p_stage IS NULL OR p_stage NOT IN ('OPEN','PRECHECK','READY_TO_CLOSE','SOFT_CLOSED','SETTLING','RECONCILING','AWARD_FINALIZED','MATURING','PAYABLE_READY','PAYMENT_REVIEW','EXPORTED','BANK_RECONCILING','FINANCIALLY_RECONCILED','CLOSED','BLOCKED') THEN
  RAISE EXCEPTION 'COMPENSATION_STAGE_OBSERVATION_INVALID' USING ERRCODE='23514';
 END IF;
 -- epoch-based identity remains stable across connection timezone settings.
 PERFORM pg_advisory_xact_lock(hashtextextended(extract(epoch from p_start)::text||':'||extract(epoch from p_end)::text||':'||p_rule,0));
 SELECT source_as_of INTO watermark FROM integration.compensation_stage_watermark
  WHERE period_start=p_start AND period_end=p_end AND rule_version_code=p_rule;
 SELECT * INTO prior FROM integration.compensation_stage_observation
  WHERE period_start=p_start AND period_end=p_end AND rule_version_code=p_rule
  ORDER BY revision DESC LIMIT 1;
 IF prior.observation_id IS NOT NULL AND p_source_as_of<=watermark THEN
  RETURN NEXT prior;RETURN;
 END IF;
 INSERT INTO integration.compensation_stage_watermark VALUES(p_start,p_end,p_rule,p_source_as_of)
  ON CONFLICT(period_start,period_end,rule_version_code) DO UPDATE SET source_as_of=EXCLUDED.source_as_of;
 IF prior.observation_id IS NOT NULL AND p_stage=prior.stage THEN RETURN NEXT prior;RETURN;END IF;
 RETURN QUERY INSERT INTO integration.compensation_stage_observation(period_start,period_end,rule_version_code,revision,previous_stage,stage,source_as_of,evidence_hash)
  VALUES(p_start,p_end,p_rule,COALESCE(prior.revision,0)+1,prior.stage,p_stage,p_source_as_of,p_hash) RETURNING *;
END $$;
