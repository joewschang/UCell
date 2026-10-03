-- R1.0B Retail Referral award type. Existing BonusAward lifecycle remains authoritative.
ALTER TYPE ledger."BonusAwardType" ADD VALUE IF NOT EXISTS 'RETAIL_REFERRAL';
