import {expect,it} from 'vitest';
import {agingEvidenceLink} from './aging-evidence-link';
it.each(['BANK_TRANSFER_FAILED','PAYOUT_EXPORTED_UNRESOLVED'])('opens payout evidence for %s',category=>expect(agingEvidenceLink(category,24)?.href).toBe('/operations-control?scope=PAYOUT#financial-source-health'));
it('keeps payable and recovery sources separate',()=>{expect(agingEvidenceLink('PAYABLE_NOT_BATCHED',24)?.href).toContain('scope=PAYABLE');expect(agingEvidenceLink('RECOVERY_OUTSTANDING',24)?.href).toContain('scope=RECOVERY');});
it('retains the explicit ERP threshold',()=>expect(agingEvidenceLink('ERP_BRIDGE_ATTENTION',48)?.href).toBe('/operations-control?stream=FULFILLMENT&thresholdHours=48'));
it('does not invent a source for missing-payable awards or invalid thresholds',()=>{expect(agingEvidenceLink('MATURED_AWARD_NOT_PAYABLE',24)).toBeNull();expect(agingEvidenceLink('ERP_BRIDGE_ATTENTION',0)).toBeNull();expect(agingEvidenceLink('UNKNOWN',24)).toBeNull();});
