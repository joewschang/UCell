'use strict';

const assert = require('node:assert/strict');
const {createHash, randomUUID} = require('node:crypto');
const {createRequire} = require('node:module');
const path = require('node:path');
const {run} = require('./release.cjs');
const {PrismaClient} = createRequire(path.resolve(__dirname, '../../../backend/package.json'))('@prisma/client');
const official = require('../../../Docs/official/2026-10-14/contracts/formal-membership.json');

// Reconstruct the predecessor from its archived source and the 10/29 published edits.
function previousText() {
  return official.contentText
    .replaceAll('直銷商與其配偶視為單一經營主體︐共享同一直銷權︐任一方不得於其他推薦體系另行申請或持有直銷權','夫妻得各自申請及經營獨立會員資格，雙方互不影響；申請、審核與權益均以本人資料及資格為準')
    .replace('配偶同權原則與禁止搶線','獨立經營與禁止搶線').replace('配偶共享直銷權︓','夫妻獨立經營︓')
    .replace(/配偶姓名（如有才需填寫）[\s\S]*?(?=聯絡電話 Phone No\.:)/,'')
    .replace('C021 至 C024 家庭情形及社會關係︓婚姻狀況、配偶姓名與身分證明（涉及配偶共同直銷權時）、推薦人與安置上下線體系關係等。','推薦與組織關係︓推薦人與安置上下線體系關係等。');
}

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert(['localhost','127.0.0.1'].includes(url.hostname));
  const template = url.pathname.slice(1);
  assert.match(template,/^ucell_(jest|dev_golden)_[a-f0-9]{32}$/);
  const dbName = 'ucell_dev_golden_' + randomUUID().replaceAll('-','');
  const controlUrl = new URL(url); controlUrl.pathname = '/postgres';
  url.pathname = '/' + dbName;
  const admin = new PrismaClient({datasources:{db:{url:controlUrl.href}}});
  const db = new PrismaClient({datasources:{db:{url:url.href}}});
  let created = false;
  try {
    await admin.$executeRawUnsafe('CREATE DATABASE "'+dbName+'" TEMPLATE "'+template+'"');
    created = true;
    assert.equal(await db.contractDocumentVersion.count({where:{contractType:'FORMAL_MEMBERSHIP'}}),0, 'Expected an empty test template');
    const versions = db.contractDocumentVersion;
    const old = await versions.create({data:{
      contractType:'FORMAL_MEMBERSHIP',versionCode:'INDEPENDENT-20261029',title:official.title,
      audience:'FORMAL_MEMBER',required:true,contentText:previousText(),
      contentHash:'e70c02cc9a45bcb6f5c1c2baebd7d3122b16635526f8a8d6e0137ef4a343977c',
      effectiveFrom:new Date('2026-10-29T03:00:00Z'),approvalReference:'USER_INSTRUCTION_INDEPENDENT_MEMBERS_20261029',
    }});
    const other = await versions.create({data:{
      contractType:'NETWORK_MEMBERSHIP',versionCode:'NETWORK-FIXTURE',title:'Independent agreement',audience:'NETWORK_MEMBER',required:true,
      contentText:'Network fixture',contentHash:createHash('sha256').update('Network fixture').digest('hex'),effectiveFrom:old.effectiveFrom,approvalReference:'QA',
    }});
    const person = await db.person.create({data:{legalName:'QA only'}});
    const consent = await db.consentEvidence.create({data:{
      personId:person.personId,contractDocumentVersionId:old.contractDocumentVersionId,
      contentHashSnapshot:old.contentHash,channel:'MEMBER_WEB',requestId:'test',correlationId:randomUUID(),evidenceHash:'a'.repeat(64),
    }});
    await assert.rejects(run(db,'verify'), /has not been published/);
    assert.equal((await run(db,'trial')).status,'rolled back');
    assert.deepEqual(await versions.findUniqueOrThrow({where:{contractDocumentVersionId:old.contractDocumentVersionId}}),old);
    assert.equal(await versions.count({where:{contractType:old.contractType}}),1);
    const attempts = await Promise.all([run(db,'apply'),run(db,'apply')]);
    assert.deepEqual(attempts.map(x=>x.status).sort(),['applied','published']);
    assert.equal((await run(db,'verify')).status,'published');
    const [closed,published] = await versions.findMany({where:{contractType:old.contractType},orderBy:{effectiveFrom:'asc'}});
    assert.deepEqual(closed,{...old,effectiveTo:published.effectiveFrom});
    const presentAt = async at => (await versions.findMany({where:{contractType:old.contractType,effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]}})).map(x=>x.versionCode);
    assert.deepEqual(await presentAt(new Date(published.effectiveFrom.getTime()-1)),[old.versionCode]);
    assert.deepEqual(await presentAt(published.effectiveFrom),[published.versionCode]);
    assert.deepEqual(await db.consentEvidence.findUniqueOrThrow({where:{consentEvidenceId:consent.consentEvidenceId}}),consent);
    assert.equal(await db.consentEvidence.count({where:{contractDocumentVersionId:published.contractDocumentVersionId}}),0);
    assert.deepEqual(await versions.findUniqueOrThrow({where:{contractDocumentVersionId:other.contractDocumentVersionId}}),other);
    await assert.rejects(db.$executeRaw`UPDATE identity.contract_document_version SET title='tamper' WHERE contract_document_version_id=${old.contractDocumentVersionId}::uuid`, /contract document version is immutable/);
    console.log('CONTRACT_RELEASE_PASS',published.versionCode,published.contentHash);
  } finally {
    await db.$disconnect();
    if (created) await admin.$executeRawUnsafe('DROP DATABASE "'+dbName+'"');
    await admin.$disconnect();
  }
}

main().catch(error => {console.error(error); process.exitCode=1;});
