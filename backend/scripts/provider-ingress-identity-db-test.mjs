import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient(); let assertions = 0; const id = () => randomUUID();
async function rejects(tx, label, statement, constraint) {
  const savepoint = `provider_identity_${assertions}`; await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  try { await tx.$executeRawUnsafe(statement); assert.fail(`${label}: operation unexpectedly succeeded`); }
  catch (error) { assert.match(String(error?.message ?? error), constraint, `${label}: unexpected database error`); assertions += 1; }
  finally { await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`); await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`); }
}
try {
  await db.$transaction(async tx => {
    const connectionId=id(), versionId=id(), webhookId=id(), runId=id(), correlationId=id();
    await tx.$executeRawUnsafe(`INSERT INTO commerce.provider_connection (provider_connection_id,domain,provider,connection_key,status,updated_at) VALUES ('${connectionId}','PAYMENT','TEST_PROVIDER','merchant-1','ACTIVE',now())`);
    await tx.$executeRawUnsafe(`INSERT INTO commerce.provider_connection_version (provider_connection_version_id,provider_connection_id,version,environment,credential_secret_ref,webhook_verification_ref,config_hash,effective_from,created_by_actor) VALUES ('${versionId}','${connectionId}',1,'TEST','secret://credential','secret://webhook','${'a'.repeat(64)}',now(),'DB_ASSERTION')`);
    await tx.$executeRawUnsafe(`INSERT INTO commerce.provider_webhook_inbox (provider_webhook_inbox_id,domain,provider,connection_id,ingress_key,payload_hash,safe_evidence_ref,verification_config_version,correlation_id,provider_connection_version_id) VALUES ('${webhookId}','PAYMENT','TEST_PROVIDER','merchant-1','valid','${'b'.repeat(64)}','evidence://webhook','TEST_V1','${correlationId}','${versionId}')`);
    await tx.$executeRawUnsafe(`INSERT INTO commerce.provider_reconciliation_run (provider_reconciliation_run_id,domain,provider,connection_id,run_key,period_start,period_end,verification_config_version,correlation_id,provider_connection_version_id) VALUES ('${runId}','PAYMENT','TEST_PROVIDER','merchant-1','valid',now()-interval '1 hour',now(),'TEST_V1','${correlationId}','${versionId}')`);
    assert.equal(await tx.providerWebhookInbox.count({where:{providerWebhookInboxId:webhookId}}),1); assertions++;
    assert.equal(await tx.providerReconciliationRun.count({where:{providerReconciliationRunId:runId}}),1); assertions++;
    const webhook=(domain,provider,key)=>`INSERT INTO commerce.provider_webhook_inbox (domain,provider,connection_id,ingress_key,payload_hash,safe_evidence_ref,verification_config_version,correlation_id,provider_connection_version_id) VALUES ('${domain}','${provider}','${key}','${id()}','${'c'.repeat(64)}','evidence://invalid','TEST_V1','${id()}','${versionId}')`;
    await rejects(tx,'webhook domain drift',webhook('INVOICE','TEST_PROVIDER','merchant-1'),/provider_webhook_inbox identity does not match/);
    await rejects(tx,'webhook provider drift',webhook('PAYMENT','OTHER_PROVIDER','merchant-1'),/provider_webhook_inbox identity does not match/);
    await rejects(tx,'webhook connection drift',webhook('PAYMENT','TEST_PROVIDER','merchant-2'),/provider_webhook_inbox identity does not match/);
    const run=(domain,provider,key)=>`INSERT INTO commerce.provider_reconciliation_run (domain,provider,connection_id,run_key,period_start,period_end,verification_config_version,correlation_id,provider_connection_version_id) VALUES ('${domain}','${provider}','${key}','${id()}',now()-interval '1 hour',now(),'TEST_V1','${id()}','${versionId}')`;
    await rejects(tx,'run domain drift',run('LOGISTICS','TEST_PROVIDER','merchant-1'),/provider_reconciliation_run identity does not match/);
    await rejects(tx,'run provider drift',run('PAYMENT','OTHER_PROVIDER','merchant-1'),/provider_reconciliation_run identity does not match/);
    await rejects(tx,'run connection drift',run('PAYMENT','TEST_PROVIDER','merchant-2'),/provider_reconciliation_run identity does not match/);
    await rejects(tx,'webhook update drift',`UPDATE commerce.provider_webhook_inbox SET provider='OTHER_PROVIDER' WHERE provider_webhook_inbox_id='${webhookId}'`,/provider_webhook_inbox identity does not match/);
    await rejects(tx,'run update drift',`UPDATE commerce.provider_reconciliation_run SET connection_id='merchant-2' WHERE provider_reconciliation_run_id='${runId}'`,/provider_reconciliation_run identity does not match/);
    await rejects(tx,'parent drift',`UPDATE commerce.provider_connection SET connection_key='merchant-2' WHERE provider_connection_id='${connectionId}'`,/cannot become inconsistent/);
  });
  console.log(`PROVIDER_INGRESS_IDENTITY_DB_PASS: ${assertions} assertions; webhook, reconciliation and parent identity drift rejected`);
} finally { await db.$disconnect(); }
