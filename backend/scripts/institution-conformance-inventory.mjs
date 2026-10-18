// Read-only source/test inventory. Name matches are discovery aids, NEVER coverage proof.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceDir = process.argv[2];
const sourceDir = process.argv[3];
if (!evidenceDir || !sourceDir) throw new Error('Usage: node scripts/institution-conformance-inventory.mjs <evidence-directory> <extracted-source-directory>');
const read = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const relative = p => path.relative(root, p).replaceAll('\\', '/');
const routes = [];
const controllerFiles = walk(path.join(root, 'backend/apps/api/src')).filter(p => p.endsWith('.controller.ts'));
const decorators = node => ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
const calls = node => decorators(node).map(d => d.expression).filter(ts.isCallExpression);
for (const file of controllerFiles) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isClassDeclaration(node)) {
      const controller = calls(node).find(c => c.expression.getText(source) === 'Controller');
      if (controller) for (const member of node.members) for (const call of calls(member)) {
        const verb = call.expression.getText(source);
        if (!['Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options', 'All'].includes(verb)) continue;
        const literal = expression => !expression ? '' : ts.isStringLiteralLike(expression) ? expression.text : `DYNAMIC:${expression.getText(source)}`;
        routes.push({ file: relative(file), line: source.getLineAndCharacterOfPosition(member.getStart(source)).line + 1,
          controller: node.name?.text, handler: member.name?.getText(source), method: verb.toUpperCase(),
          controllerPath: literal(controller.arguments[0]), methodPath: literal(call.arguments[0]),
          acceptance: 'UNMAPPED', note: 'Static declaration only; global prefix, runtime registration and access matrix need explicit HTTP cases.' });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const apiEvidenceNames = ['institution-release-jest-20261011.json', 'institution-retest-jest-20261011.json', 'institution-route-jest-20261011.json'];
const nextRegression = 'institution-next-regression-20261011.json';
if (fs.existsSync(path.join(evidenceDir, nextRegression))) apiEvidenceNames.push(nextRegression);
const results = [...apiEvidenceNames, 'institution-admin-20261011.json', 'institution-member-20261011.json'].map(name => {
  const file = path.join(evidenceDir, name);
  const data = JSON.parse(read(file));
  return { file, sha256: hash(file), passed: data.numPassedTests, failed: data.numFailedTests, pending: data.numPendingTests,
    cases: data.testResults.flatMap(s => {
      const occurrences = new Map();
      return (s.assertionResults ?? []).map(a => {
        const name = a.fullName ?? a.title, occurrence = (occurrences.get(name) ?? 0) + 1;
        occurrences.set(name, occurrence);
        return { suite: s.name, name, occurrence, status: a.status };
      });
    }) };
});
// Preserve every raw run, and separately resolve each exact case to its latest
// executed evidence. Retests must not inflate the unique-case count.
const latestApi = new Map();
for (const run of results.slice(0, apiEvidenceNames.length)) for (const row of run.cases) latestApi.set(`${row.suite}\0${row.name}\0${row.occurrence}`, { ...row, evidenceFile: run.file });
const finalApiCases = [...latestApi.values()];
if (finalApiCases.some(row => row.status !== 'passed')) throw new Error('Unresolved API failures or skipped cases; no conformance success summary permitted');
const finalApi = { method: 'FULL_RUN_PLUS_EXACT_CASE_RETESTS_AND_ADDITIONAL_ROUTE_SUITE',
  suites: new Set(finalApiCases.map(row => row.suite)).size, passed: finalApiCases.length, failed: 0, pending: 0, cases: finalApiCases };
const sources = walk(sourceDir).filter(p => p.endsWith('.json')).map(file => {
  const source = JSON.parse(read(file));
  return { ...source, paragraphs: source.paragraphs.map(p => ({ ...p, acceptance: 'UNMAPPED', note: 'A paragraph is not necessarily a requirement; decomposition and authority review remain required.' })) };
});
const decisionFile = path.join(root, 'governance/sa-decisions/decisions.json');
const decisions = JSON.parse(read(decisionFile)).decisions.map(d => ({ ...d, acceptance: 'UNMAPPED' }));
const lifecycleFile = path.join(root, 'governance/sa-decisions/R1_0B_RULE_ALIGNMENT_MEMBERSHIP_LIFECYCLE_20261003.md');
const lifecycle = read(lifecycleFile).split(/\r?\n/).flatMap((line, index) => {
  const m = line.match(/^(?:\|\s*)?((?:ALIGN|MEM|RES|LIFE|GATE)-\d{2})(?:\s*\||：)(.*)$/);
  return m ? [{ id: m[1], line: index + 1, text: m[2].trim(), acceptance: 'UNMAPPED' }] : [];
});
const partial = {
  'ALIGN-02': ['institution-rpv-generation-matrix-db', '5/8/12 depths, every G1–13, historical directs, retry; legacy A profile unresolved.'],
  'ALIGN-03': ['annual-epv-simulation-db', '15 months; self and fixed Sponsor G1–5, one inactive month; fixture organization.'],
  'ALIGN-04': ['annual-epv-simulation-db', 'Cumulative threshold and Ball isolation; full payment mix not certified.'],
  'LIFE-01': ['institution-inactivity-rules', 'Pure evaluator Ball isolation only; no integrated reclamation.'],
  'LIFE-03': ['institution-inactivity-rules', 'First complete Taipei month helper tested; not wired into production scheduler.'],
  'LIFE-04': ['institution-inactivity-rules', 'Adjacent-month evaluator and reset; no production monthly workflow.'],
  'LIFE-07': ['institution-inactivity-rules', 'Revised evidence recomputation only; POSTED return-to-review integration missing.'],
};
for (const rule of lifecycle) {
  if (partial[rule.id]) {
    const [pattern, boundary] = partial[rule.id];
    const evidence = results[0].cases.filter(c => c.suite.includes(pattern));
    rule.acceptance = 'PARTIAL'; rule.boundary = boundary; rule.cases = evidence;
    if (!evidence.length || evidence.some(c => c.status !== 'passed')) throw new Error(`Missing passing partial evidence: ${rule.id}`);
  } else if (rule.id.startsWith('GATE-')) rule.acceptance = 'OPEN_POLICY_OR_RELEASE_GATE';
  else if (['LIFE-05', 'LIFE-06', 'LIFE-08'].includes(rule.id)) {
    rule.acceptance = 'MISSING_INTEGRATED_WORKFLOW';
    rule.boundary = 'Existing generic messaging/owner transfer is not evidence of the specified inactivity notice, objection and reclamation pipeline.';
  }
}
const coreRules = [
  { paragraph: 12, subject: 'G1 plan rates and shared K0 pool', suite: 'bonus-engine-v04', name: /G1 .* Active receives|share 42% pool/, boundary: 'Real arithmetic with transaction-local mocked persistence; not an annual combined ledger.' },
  { paragraph: 14, subject: 'Equalization plan generation rates', suite: 'bonus-engine-v04', name: /STARTER rates|ELITE rates|LEADER rates/, boundary: 'Explicit rate arrays, recipients and plan snapshots; historical persistence separately tested.' },
  { paragraph: 22, subject: 'RPV direct 0/1/2 unlocks 5/8/12', suite: 'institution-rpv-generation-matrix-db', name: /RPV-D/, boundary: 'Real DB and historical directs; not all subscription/payment/shipping combinations.' },
  { paragraph: 26, subject: 'Monthly EPV, own 50% and five Sponsor generations at 6%', suite: 'annual-epv-simulation-db', name: /.*/, boundary: '15-month DB scenario; input orders and eligibility history are fixtures.' },
  { paragraph: 28, subject: 'Upgrade review fee and approval effective time', suite: 'institution-upgrade-db', name: /.*/, boundary: 'Direction, stale requests, fee flag, history and backdate rejection verified. Actual plan-difference payment and fee evidence reconciliation remain unverified.' },
].map(({ name, ...rule }) => {
  const cases = results[0].cases.filter(c => c.suite.includes(rule.suite) && name.test(c.name));
  if (!cases.length || cases.some(c => c.status !== 'passed')) throw new Error(`Missing core evidence P${rule.paragraph}`);
  return { ...rule, source: 'UCell_R1_0B_獎金引擎與核心邏輯規格書_v4_2_20261003.docx', acceptance: 'PARTIAL', cases };
});
const adminRouteEvidence = JSON.parse(read(path.join(evidenceDir, 'institution-admin-route-status-20261011.json')));
const acceptancePath = path.join(evidenceDir, 'institution-next-acceptance-20261011.json');
const acceptanceRaw = fs.existsSync(acceptancePath) ? JSON.parse(read(acceptancePath)) : null;
const businessAcceptance = acceptanceRaw ? { file: acceptancePath, sha256: hash(acceptancePath), passed: acceptanceRaw.numPassedTests,
  failed: acceptanceRaw.numFailedTests, pending: acceptanceRaw.numPendingTests,
  cases: acceptanceRaw.testResults.flatMap(s => s.assertionResults.map(a => ({ suite: s.name, name: a.fullName, status: a.status, failureMessages: a.failureMessages }))) } : null;
const data = { generatedAt: new Date().toISOString(), status: businessAcceptance?.failed ? 'FAILED_BUSINESS_ACCEPTANCE' : 'PARTIAL_VALIDATED_NOT_FULL_ACCEPTANCE',
  coveragePercent: null, limitation: 'No validated complete requirement denominator. Tests passing and static route counts must not be presented as full institution coverage.',
  summary: { declaredRoutes: routes.length, controllers: controllerFiles.length, sourceParagraphs: sources.reduce((n, s) => n + s.paragraphs.length, 0), decisions: decisions.length, lifecycleClauses: lifecycle.length },
  sourceFiles: [decisionFile, lifecycleFile, ...controllerFiles,
    ...walk(path.join(root, 'backend/apps/api/test')).filter(p => /\.(ts|json)$/.test(p)),
    path.join(root, 'backend/apps/api/src/modules/qualification/qualification-inactivity.ts'),
    path.join(root, 'backend/apps/api/src/modules/qualification/qualification-workflow.service.ts'),
  ].map(file => ({ file: relative(file), sha256: hash(file) })),
  lifecycle, coreRules, decisions, routes, adminRouteEvidence, sources, results, finalApi, businessAcceptance };
const output = path.join(evidenceDir, businessAcceptance ? 'institution-conformance-inventory-next-20261011.json' : 'institution-conformance-inventory-20261011.json');
fs.writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify({ output, status: data.status, ...data.summary, finalApi: { suites: finalApi.suites, passed: finalApi.passed }, businessAcceptance: businessAcceptance && { passed: businessAcceptance.passed, failed: businessAcceptance.failed, pending: businessAcceptance.pending }, results: results.map(({ file, passed, failed, pending }) => ({ file, passed, failed, pending })) }, null, 2));
