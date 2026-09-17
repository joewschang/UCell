import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const evidenceId = randomUUID();
const actorId = randomUUID();
const correlationId = randomUUID();
const suffix = randomUUID();
const results = [];

async function expectedFailure(label, operation, expectedText) {
  try {
    await operation();
    results.push({ label, pass: false, detail: 'operation unexpectedly succeeded' });
  } catch (error) {
    const detail = String(error?.message ?? error);
    results.push({ label, pass: detail.includes(expectedText), detail: detail.includes(expectedText) ? expectedText : detail.slice(0, 300) });
  }
}

try {
  await db.$executeRawUnsafe(`
    INSERT INTO audit.uat_execution_evidence
      (uat_execution_evidence_id, classification, environment, scenario_code, result,
       evidence_hash, artifact_reference, actor_id, executed_at, request_id, correlation_id)
    VALUES
      ('${evidenceId}', 'LOCAL_ASSISTIVE_ONLY', 'CONNECTED_DEV', 'DB-${suffix}', 'PASS',
       '${'a'.repeat(64)}', 'artifact://db-test/${suffix}', '${actorId}', now(), 'db-test-${suffix}', '${correlationId}')
  `);
  results.push({ label: 'local evidence insert', pass: true });

  await expectedFailure(
    'append-only update trigger',
    () => db.$executeRawUnsafe(`UPDATE audit.uat_execution_evidence SET result='FAIL' WHERE uat_execution_evidence_id='${evidenceId}'`),
    'UAT evidence is append-only',
  );
  await expectedFailure(
    'append-only delete trigger',
    () => db.$executeRawUnsafe(`DELETE FROM audit.uat_execution_evidence WHERE uat_execution_evidence_id='${evidenceId}'`),
    'UAT evidence is append-only',
  );
  await expectedFailure(
    'formal approval DB constraint',
    () => db.$executeRawUnsafe(`
      INSERT INTO audit.uat_execution_evidence
        (uat_execution_evidence_id, classification, environment, scenario_code, result,
         evidence_hash, artifact_reference, actor_id, executed_at, request_id, correlation_id)
      VALUES
        ('${randomUUID()}', 'FORMAL_UAT_EVIDENCE', 'UAT', 'DB-FORMAL-${suffix}', 'PASS',
         '${'b'.repeat(64)}', 'artifact://db-test/formal/${suffix}', '${actorId}', now(), 'db-formal-${suffix}', '${randomUUID()}')
    `),
    'uat_execution_evidence_formal_approval_check',
  );

  const failed = results.filter(result => !result.pass);
  console.log(JSON.stringify({ assertions: results.length, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  if (failed.length) process.exitCode = 1;
} finally {
  await db.$disconnect();
}
