'use strict';

const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');

const type = 'FORMAL_MEMBERSHIP';
const previous = 'INDEPENDENT-20261029';
const version = 'DIRECT-PLACEMENT-20261112';
const previousHash = 'e70c02cc9a45bcb6f5c1c2baebd7d3122b16635526f8a8d6e0137ef4a343977c';
const newHash = '5933d26cb37f38233386f64265d2e875dce949f9dd5b3f244a08fb62982e9d4e';
const approval = 'USER_INSTRUCTION_DIRECT_PLACEMENT_20261112';
const oldSentence = '推薦人第一（G1-1）及第三（G1-3）個直接推薦之資格︐必須強制依序安置於該推薦資格之「左側子樹」合法空位︔第二（G1-2）及第四（G1-4）個以後之資格︐得於該推薦資格子樹之合規範圍內自選安置位置。';
const newSentence = '直接推薦之資格，得於該推薦資格子樹之合規範圍內，自選左側或右側合法空位。';
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');

function amendedText(row) {
  assert.equal(row.content_hash, previousHash, 'Unexpected stored source hash');
  assert.equal(sha(row.content_text), previousHash, 'Unexpected source bytes');
  assert.equal(row.content_text.split(oldSentence).length, 2, 'Expected the old sentence exactly once');
  const text = row.content_text.replace(oldSentence, newSentence);
  assert.equal(sha(text), newHash, 'Amendment differs from approved text');
  return text;
}

async function checkedTrigger(tx) {
  const rows = await tx.$queryRawUnsafe(`SELECT t.tgenabled AS mode FROM pg_trigger t
    WHERE t.tgrelid='identity.contract_document_version'::regclass
      AND t.tgname='contract_document_version_immutable' AND NOT t.tgisinternal
      AND t.tgfoid='identity.reject_contract_version_mutation()'::regprocedure`);
  assert.equal(rows.length, 1, 'Immutable trigger missing');
  assert.equal(rows[0].mode, 'O', 'Immutable trigger must be enabled');
}

async function readVersions(tx) {
  const rows = await tx.$queryRawUnsafe(`SELECT to_jsonb(d) AS doc FROM identity.contract_document_version d
    WHERE contract_type=$1 AND (version_code IN ($2,$3) OR effective_to IS NULL OR effective_to>statement_timestamp())
    ORDER BY effective_from`, type, previous, version);
  const docs = rows.map(row => row.doc);
  const old = docs.find(row => row.version_code === previous);
  const next = docs.find(row => row.version_code === version);
  assert(old, 'Missing source agreement');
  assert.equal(old.audience, 'FORMAL_MEMBER');
  assert.equal(old.required, true);
  assert.equal(old.approval_reference, 'USER_INSTRUCTION_INDEPENDENT_MEMBERS_20261029');
  assert.equal(docs.length, next ? 2 : 1, 'Another open or scheduled version exists');
  const active = await tx.$queryRawUnsafe(`SELECT version_code FROM identity.contract_document_version
    WHERE contract_type=$1 AND effective_from<=statement_timestamp()
      AND (effective_to IS NULL OR effective_to>statement_timestamp())`, type);
  assert.deepEqual(active.map(row => row.version_code), [next ? version : previous], 'Unexpected active version');
  return {old, next};
}

function checkPublished(old, next, content) {
  assert(next, 'New agreement has not been published');
  assert.notEqual(next.contract_document_version_id, old.contract_document_version_id);
  assert.equal(next.effective_from, old.effective_to);
  assert.equal(next.effective_to, null);
  assert.equal(next.content_hash, newHash);
  assert.equal(next.content_text, content);
  assert.deepEqual(next, {
    ...old,
    contract_document_version_id: next.contract_document_version_id,
    version_code: version, content_text: content, content_hash: newHash,
    effective_from: old.effective_to, effective_to: null,
    approval_reference: approval, created_at: old.effective_to,
  }, 'Unexpected change to agreement metadata');
}

async function run(db, mode) {
  assert(['trial', 'apply', 'verify'].includes(mode), 'Use trial, apply or verify');
  const rollback = new Error('Trial completed');
  let result;
  try {
    await db.$transaction(async tx => {
      if (mode === 'verify') {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      } else {
        // Acquire the lock before any version reads, including on concurrent retries.
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout='10s'");
        await tx.$executeRawUnsafe('LOCK TABLE identity.contract_document_version IN ACCESS EXCLUSIVE MODE');
      }
      await checkedTrigger(tx);
      const before = await readVersions(tx);
      const content = amendedText(before.old);
      if (before.next || mode === 'verify') {
        checkPublished(before.old, before.next, content);
        result = {status:'published', version, contentHash:newHash, effectiveFrom:before.next.effective_from};
        return;
      }
      assert.equal(before.old.effective_to, null, 'Source agreement already has a closing date');
      const [{cutover}] = await tx.$queryRawUnsafe("SELECT date_trunc('milliseconds', clock_timestamp()) AS cutover");
      const stamp = cutover.toISOString();
      const sourceId = before.old.contract_document_version_id;
      // DDL is transactional. The exclusive lock covers the entire period the trigger is disabled.
      await tx.$executeRawUnsafe('ALTER TABLE identity.contract_document_version DISABLE TRIGGER contract_document_version_immutable');
      assert.equal(await tx.$executeRawUnsafe(`UPDATE identity.contract_document_version SET effective_to=$1::timestamptz
        WHERE contract_document_version_id=$2::uuid AND effective_to IS NULL`, stamp, sourceId), 1);
      await tx.$executeRawUnsafe('ALTER TABLE identity.contract_document_version ENABLE TRIGGER contract_document_version_immutable');
      assert.equal(await tx.$executeRawUnsafe(`INSERT INTO identity.contract_document_version
        SELECT (jsonb_populate_record(d, jsonb_build_object(
          'contract_document_version_id',$1::uuid,'version_code',$2::text,'content_text',$3::text,
          'content_hash',$4::text,'effective_from',$5::timestamptz,'effective_to',NULL,
          'approval_reference',$6::text,'created_at',$5::timestamptz))).*
        FROM identity.contract_document_version d WHERE contract_document_version_id=$7::uuid`,
        randomUUID(), version, content, newHash, stamp, approval, sourceId), 1);
      await checkedTrigger(tx);
      const after = await readVersions(tx);
      assert.deepEqual(after.old, {...before.old, effective_to:after.next.effective_from}, 'Source record changed beyond end of validity');
      checkPublished(after.old, after.next, content);
      result = {status:mode === 'trial' ? 'rolled back' : 'applied', version, contentHash:newHash, effectiveFrom:after.next.effective_from};
      if (mode === 'trial') throw rollback;
    }, {isolationLevel: mode === 'verify' ? 'RepeatableRead' : 'ReadCommitted', timeout:30000});
  } catch (error) {
    if (error !== rollback) throw error;
  }
  return result;
}

module.exports = {run, amendedText};
if (require.main === module) {
  const {PrismaClient} = require('/app/packages/database/node_modules/@prisma/client');
  const db = new PrismaClient();
  run(db, process.argv[2]).then(row => console.log(JSON.stringify(row)))
    .catch(error => {console.error(error.message); process.exitCode = 1;})
    .finally(() => db.$disconnect());
}
