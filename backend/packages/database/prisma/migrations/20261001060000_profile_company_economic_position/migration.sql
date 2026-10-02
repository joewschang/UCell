-- Match the profile-derived binding span introduced by migration 88.
-- Existing destination identity/owner/tree/binding triggers remain authoritative.
ALTER TABLE ledger.award_economic_destination
 DROP CONSTRAINT award_economic_destination_company_position_check;
ALTER TABLE ledger.award_economic_destination
 ADD CONSTRAINT award_economic_destination_company_position_check
 CHECK (company_position IS NULL OR company_position >= 1);
