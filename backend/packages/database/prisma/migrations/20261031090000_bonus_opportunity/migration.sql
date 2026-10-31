CREATE TABLE ledger.bonus_opportunity (
 bonus_opportunity_id UUID PRIMARY KEY,
 review_required BOOLEAN NOT NULL DEFAULT false,
 opportunity_key TEXT NOT NULL UNIQUE,
 settlement_batch_id UUID REFERENCES ledger.settlement_batch(settlement_batch_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 person_id UUID NOT NULL REFERENCES identity.person(person_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 qualification_id UUID NOT NULL REFERENCES membership.qualification(qualification_id) ON DELETE RESTRICT ON UPDATE CASCADE,
 source_key TEXT NOT NULL,
 award_type TEXT NOT NULL,
 generation INTEGER NOT NULL,
 theoretical_amount DECIMAL(18,4) NOT NULL,
 estimated_amount DECIMAL(18,4) NOT NULL,
 reasons JSONB NOT NULL,
 occurred_at TIMESTAMPTZ(6) NOT NULL,
 rule_version_code TEXT NOT NULL,
 parameter_snapshot_hash TEXT NOT NULL,
 calculation_detail JSONB NOT NULL,
 message TEXT NOT NULL,
 outbox_event_id UUID NOT NULL UNIQUE,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT bonus_opportunity_positive CHECK (theoretical_amount > 0 AND estimated_amount > 0)
);
CREATE INDEX bonus_opportunity_person_id_qualification_id_occurred_at_idx ON ledger.bonus_opportunity(person_id,qualification_id,occurred_at);
CREATE INDEX bonus_opportunity_settlement_batch_id_idx ON ledger.bonus_opportunity(settlement_batch_id);
