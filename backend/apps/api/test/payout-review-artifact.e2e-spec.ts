import {createHash} from 'node:crypto';
import {createFinanceReviewArtifact,readFinanceReviewArtifact,type FinanceSnapshot} from '../src/modules/admin-operations/payout-review-artifact';
const source:FinanceSnapshot={schemaVersion:1,format:'GENERIC_FINANCE_CSV_V1',exportRevision:1,payoutBatchId:'private-batch',periodStart:'2026-01-01T00:00:00.000Z',periodEnd:'2026-02-01T00:00:00.000Z',totalGross:'100',totalRecovery:'10',totalNet:'90',lines:[{payoutLineId:'private-line',memberNo:'=DANGEROUS()',ballNo:'BALL-1',grossAmount:'100',recoveryOffset:'10',netAmount:'90'}]};
it('creates deterministic safe UTF-8 finance review bytes without internal source IDs',()=>{
 const first=createFinanceReviewArtifact(source,'=EXPORT()'),second=createFinanceReviewArtifact(source,'=EXPORT()');expect(first).toEqual(second);
 expect(first.payloadSnapshot.content).toContain('"\'=EXPORT()"');expect(first.payloadSnapshot.content).toContain('"\'=DANGEROUS()"');expect(first.payloadSnapshot.content).not.toContain('private-');
 expect(first.contentHash).toBe(createHash('sha256').update(first.payloadSnapshot.content,'utf8').digest('hex'));
});
it('reconstructs a legacy V1 download only from the exact stored source hash',()=>{
 const artifact={payoutBatchId:source.payoutBatchId,revision:1,exportReference:'LEGACY',formatVersion:'GENERIC_FINANCE_CSV_V1',contentHash:createHash('sha256').update(JSON.stringify(source)).digest('hex'),payloadSnapshot:JSON.parse(JSON.stringify(source))};
 const file=readFinanceReviewArtifact(artifact);expect(file.content).toContain('LEGACY');expect(file.artifactHash).toBe(artifact.contentHash);expect(file.fileHash).not.toBe(file.artifactHash);
 expect(()=>readFinanceReviewArtifact({...artifact,payloadSnapshot:{...source,totalNet:'91'}})).toThrow('PAYOUT_ARTIFACT_INTEGRITY_INVALID');
});
it('rejects V2 byte, scope and revision corruption',()=>{
 const made=createFinanceReviewArtifact(source,'EXPORT');const artifact={...made,payoutBatchId:source.payoutBatchId,revision:1,exportReference:'EXPORT'};
 expect(readFinanceReviewArtifact(artifact).content).toBe(made.payloadSnapshot.content);
 for(const changed of [{...artifact,revision:2},{...artifact,payoutBatchId:'foreign'},{...artifact,payloadSnapshot:{...made.payloadSnapshot,content:'modified'}}])expect(()=>readFinanceReviewArtifact(changed)).toThrow('PAYOUT_ARTIFACT_INTEGRITY_INVALID');
});
