-- Freeze existing artifacts in place; never regenerate historical export data.
CREATE TRIGGER payout_export_artifact_append_only BEFORE UPDATE OR DELETE ON ledger.payout_export_artifact
 FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
