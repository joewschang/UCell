CREATE UNIQUE INDEX IF NOT EXISTS account_recovery_existing_member_line_pending_subject_idx
  ON identity.account_recovery_request (requested_provider_subject)
  WHERE type = 'EXISTING_MEMBER_LINE_LINK' AND status IN ('PENDING','APPROVED');
