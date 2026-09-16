ALTER TABLE identity.otp_challenge
 ADD COLUMN consumed_at timestamptz(6),
 ADD COLUMN consumed_by_person_id uuid,
 ADD CONSTRAINT otp_challenge_consumption_pair_check CHECK ((consumed_at IS NULL) = (consumed_by_person_id IS NULL));
CREATE UNIQUE INDEX otp_challenge_consumed_once_idx ON identity.otp_challenge(otp_challenge_id) WHERE consumed_at IS NOT NULL;
