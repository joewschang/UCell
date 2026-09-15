import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const final = path.join(dir, 'final');
const git = (...args) => {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};
const base = 'df13581';
const results = JSON.parse(fs.readFileSync(path.join(final, 'gate-results.json'), 'utf8'));
const todos = JSON.parse(fs.readFileSync(path.join(final, 'todo-inventory.json'), 'utf8'));
const counts = new Map();
for (const row of todos) counts.set(row.domain, (counts.get(row.domain) ?? 0) + 1);
const files = [...new Set([...git('diff', base, '--name-only').split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(Boolean);
const source = files.filter(file => !file.startsWith('governance/connected-dev-phase1/'));
const hashes = source.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') }));
fs.writeFileSync(path.join(final, 'source-change-manifest.json'), JSON.stringify({
  base, sourceHead: git('rev-parse', 'HEAD'), ruleVersion: 'R1.0B FROZEN',
  productionPromotion: 'BLOCKED', files: hashes,
}, null, 2) + '\n');
const preserved = git('diff', base, '--', 'backend/packages/database/prisma',
  'backend/scripts/golden-domain-test.mjs', ...todos.map(row => row.file));
if (preserved || todos.length !== 148) throw new Error('Frozen inputs or TODO source changed unexpectedly');
fs.writeFileSync(path.join(final, 'preservation-check.txt'),
  'PASS: Prisma schema/migrations/seed inputs unchanged from df13581.\nPASS: 13 original TODO files unchanged; 148 placeholders retained.\nPASS: contradictory golden-domain-test.mjs preserved for specification review.\n');
const diffCheck = spawnSync('git', ['diff', '--check', base], { cwd: root, encoding: 'utf8' });
fs.writeFileSync(path.join(final, 'git-diff-check-all-files.txt'), `exit: ${diffCheck.status}\n${diffCheck.stdout}${diffCheck.stderr}`);
const sourceDiffCheck = spawnSync('git', ['diff', '--check', base, '--', '.', ':(exclude)governance/connected-dev-phase1'], { cwd: root, encoding: 'utf8' });
fs.writeFileSync(path.join(final, 'git-diff-check.txt'), `source/config only; raw evidence excluded\nexit: ${sourceDiffCheck.status}\n${sourceDiffCheck.stdout}${sourceDiffCheck.stderr}`);
fs.writeFileSync(path.join(final, 'git-diff-stat.txt'), git('diff', base, '--stat') + '\n');
fs.writeFileSync(path.join(final, 'git-diff-summary.txt'), git('diff', base, '--summary') + '\n');
fs.writeFileSync(path.join(final, 'checkpoint-commits.txt'), git('log', `${base}..HEAD`, '--oneline') + '\n');
// Validate the workflows locally with the installed CLI's YAML parser when available.
try {
  const req = createRequire(import.meta.url);
  const store = path.join(root, 'backend/node_modules/.pnpm');
  const parser = fs.readdirSync(store).find(name => name.startsWith('js-yaml@4.'));
  if (!parser) throw new Error('Installed CommonJS js-yaml parser not found');
  const yaml = req(path.join(store, parser, 'node_modules/js-yaml'));
  for (const file of ['.github/workflows/ci.yml', '.github/workflows/rc-promotion.yml', 'backend/.github/workflows/backend-ci.yml'])
    yaml.load(fs.readFileSync(path.join(root, file), 'utf8'));
  fs.writeFileSync(path.join(final, 'workflow-yaml.txt'), 'PASS: three workflow files parse with js-yaml. GitHub Actions execution NOT RUN.\n');
} catch (error) {
  fs.writeFileSync(path.join(final, 'workflow-yaml.txt'), `NOT VERIFIED: ${error.message}\n`);
}
const failures = [
  { category: 'Toolchain compatibility', issue: 'Prisma 7 schema URL removal; TypeScript 7 vs ts-jest; NestJS 12 ESM vs CommonJS Jest; Windows URL paths; pnpm 12 build scripts; stale Node 22/pnpm 9 scaffolding', status: 'FIXED; connected runtime passed except replay implementation blocker' },
  { category: 'Dependency', issue: 'Missing direct @types/node, root ts-node/Prisma; duplicate Fastify; audit advisories in deepmerge-ts/Vite/esbuild/React Router/Vitest', status: 'FIXED; frozen install, peers and final audits PASS' },
  { category: 'TypeScript', issue: 'Vite ImportMeta.env types, crypto import, inferred API declaration types, Prisma Json null, nonexistent fields/relations', status: 'FIXED; two replay method locations remain; Nest CLI reports these twice (4 diagnostics)' },
  { category: 'Prisma/DB', issue: 'validate/generate/migrate deploy', status: 'PASS; PostgreSQL 16.15 healthy; all 16 migrations applied; no migration edits' },
  { category: 'Application implementation', issue: 'RPV source ID, EPV temporal plan lookup, polymorphic award payable query, audit DbNull, gate entrypoints', status: 'FIXED; 3 isolated API regression tests PASS; no formula changes or official monetary result writes' },
  { category: 'Application implementation', issue: 'Legacy adjustment calls absent replayBinary/replayMatching; OpenAPI and HTTP/security downstream unavailable', status: 'UNRESOLVED; blocked pending specification reconciliation; API not started from partial/stale output' },
  { category: 'Test implementation', issue: 'Missing Jest E2E config/shared golden runner and no Admin test files', status: 'FIXED for runner/bootstrap entrypoints and added tests; 148 original E2E TODO remain unchanged' },
  { category: 'Test implementation', issue: 'DB golden seed TypeScript file missing; empty database lacks five fixed-ID qualifications; conditional parameter assertions can vacuously pass', status: 'UNRESOLVED; no invented fixture or relaxed assertions' },
  { category: 'Specification ambiguity', issue: 'Single-recipient legacy adjustment versus period-wide replay/K1/K2/carry-chain scope; contradictory golden-domain EPV/pools; README source precedence differs from current user instructions; missing approved source documents/links', status: 'STOPPED affected semantic work; formal clarification required' },
];
fs.writeFileSync(path.join(final, 'failure-classification.json'), JSON.stringify(failures, null, 2) + '\n');
const gateTable = results.map(row => `| ${row.label} | ${row.result} | ${row.exitCode} | [output](final/${row.label}.txt) |`).join('\n');
const todoTable = [...counts].map(([domain, count]) => `| ${domain} | ${count} | Test implementation |`).join('\n');
const commands = results.map(row => `- ${row.cwd}: ${row.command}`).join('\n');
const report = `UCell R1.0B FROZEN — Connected DEV Engineering 第一階段報告

日期：2026-09-15（Asia/Taipei）。Repository：C:/UCell/UCell；branch：rc1-recovered。
基準 commit：df13581；本階段 checkpoint 詳見 final/checkpoint-commits.txt。
結論：工具鏈、dependency、Prisma/DB、Admin build 與明確 defects 已修復並驗證；Backend API build 仍 BLOCKED。Production Promotion 維持 BLOCKED。

**1. 修改檔案**

${source.map(file => '- ' + file).join('\n')}

新增治理證據：本資料夾的 verification/report scripts、原始 baseline 輸出、final/ 最終輸出、gate-results.json、逐筆 TODO JSON/CSV、failure-classification.json、source-change-manifest.json 與 diff/checkpoint 紀錄。

變更用途：固定 Prisma 6.19.3／TypeScript 5.9.3／NestJS 11 與單一 Fastify；補直接依賴、pnpm build allow-list、Vite client 型別、API build config、Jest runners；修正 Windows file URL、crypto import、Prisma DbNull、RPV primary key、EPV payment-time plan snapshot 與 polymorphic payable read model；強化 root tests／CI／RC 的 TODO gate；更新 Docker toolchain 與 lock policies；修補 audit 漏洞。
API 應用不輸出 declaration，仍維持 strict typechecking；build 排除 tests、禁止錯誤時產出並停用 incremental diagnostics。共用 packages 仍輸出 declarations。
allowBuilds 明列必要 native/Prisma build scripts，@scarf/scarf 明確禁止。pnpm 自動記錄了四個 NestJS 11.2.5 minimumReleaseAgeExclude；這是精確版本 exception，正式 dependency review 尚須核准，不代表供應鏈或 production 簽核完成。

**2. 執行 commands**

初始與修復命令：node --version、pnpm --version、git status --short --branch、git log、git commit --allow-empty（初始 checkpoint）、各階段 git add／git commit、rg／Get-Content repository inspection；backend/admin 各 pnpm install --lockfile-only、pnpm install --no-frozen-lockfile、pnpm install --frozen-lockfile、pnpm peers check；pnpm view 查詢 compatibility 版本。
Docker：docker version；docker ps -a；backend 下 docker compose --env-file .env.example up -d postgres；docker exec backend-postgres-1 psql -U ucell -d ucell -c SELECT version() 與 public._prisma_migrations 查詢；docker compose --env-file .env.example ps postgres。Sandbox pipe permission denial 後使用核准的 Docker escalation，並非 DB 或 application 缺陷。
最終證據 runner：node governance/connected-dev-phase1/run-verification.mjs；node governance/connected-dev-phase1/run-verification.mjs --shell-gates-only。每一命令的 cwd、時間、退出碼與完整輸出見 final/。

${commands}

Prisma/DB commands 使用 DEV DATABASE_URL。NODE_ENV=test、ADMIN_AUTH_BYPASS=false；未使用 production DB 或 Entra token。中途有一次未提供 DATABASE_URL 的 validate 失敗；最終已帶正確 DEV URL 通過。Runner 對 Git Bash 空白路徑的引號缺陷已修正，shell-only 重跑覆核最终 shell gate 結果。

**3. PASS/FAIL gates**

| Gate | 結果 | Exit | 證據 |
| --- | --- | --- | --- |
${gateTable}

PostgreSQL 實際版本 16.15，container healthy；16 migrations 首次全數部署成功，重跑顯示無 pending migration。
純 offline 21 支 scripts 的 process exit 全 PASS；ci-gate 的 dependency/build 部分仍 FAIL。
注意：golden-domain-test 的 process PASS 不採認為制度驗證，因為其 EPV amount×0.70 與 pool 42/36/12/5/5，和其他 frozen 定義 excess-above-2000×0.60／42/36/15/5/2 矛盾；原檔保留。
實際 assertions：shared frozen golden 6 PASS；API engineering regressions 3 PASS；Admin page authorization 4 PASS，合計 13。API 原 13 suites 的 148 TODO 不屬於 assertion PASS。
Backend test gate 在 suites 執行後由 TEST_TODO_GATE_FAIL 正常 exit 1；RC gate 起始即正常阻擋 TODO。
Backend/Admin 最終 audit 均 0 advisories。未把 worker/contracts/database 既有 echo no-tests 當作測試證據。
Admin bundle 620 kB 左右有 size warning，不影響 build exit。UI browser/UAT、Docker image build、遠端 Actions、live Entra/security、backup/restore/integrity 都沒有宣稱通過。Workflow YAML parser 結果見 final/workflow-yaml.txt。

**4. 未解決問題與分類**

${failures.map(row => '- ' + row.category + '：' + row.issue + '。' + row.status + '。').join('\n')}

OpenAPI export 因 replay TypeScript 失敗；generated spec 不存在，OpenAPI preflight FAIL。API build 未通過，因此沒有啟動 API，HTTP smoke／security runner 為 ECONNREFUSED；不是 security correctness PASS，也不是已證實授權漏洞。Role tokens 缺失，完整 Entra/RBAC/BOLA/IDOR 尚待執行。
UAT CSV 的 21 P0 全 NOT_RUN；9 P1 亦未執行。腳本先報 P0 FAIL，P1 不能推論通過。Backup/restore 與 zero-critical integrity evidence 尚缺。
README／治理文件保留歷史 release 說法與來源排序；本次遵循使用者指示的「已報備 > 正式核准 > R1.0 系統規格 > 討論/舊版」，不自行改寫治理依據。CURRENT_SSOT_POINTERS 只有文件名稱，無完整已報備/核准原文可供這次查證。
RELEASE_MANIFEST、SHA256SUMS 與舊 acceptance snapshots 仍是歷史包證據，不能認作目前 commit 的完整 release manifest。本次另存 source-change-manifest；正式 RC 必須重新核准並產生 release evidence，未自行解除 BLOCKED。

**5. 148 TODO 分類**

所有 148 筆的主要失敗分類為 Test implementation：只有 it.todo，沒有執行 assertion，不能憑 TODO 推論 application 缺陷。次分類按下表 domain。逐筆 id、原檔、line、原始描述與規格審查狀態見 final/todo-inventory.csv／json。

| Domain / 原始 test file stem | TODO | 主要分類 |
| --- | --- | --- |
${todoTable}
| 合計 | 148 | Test implementation |

原始 13 檔與 schema/migrations/seed inputs 對 df13581 diff 為零；沒有刪除 TODO、skip 或假 assertions。新 tests 是獨立工程回歸，不是替代或解除原 TODO gate。涉及制度者須先具備核准 specification／fixture，再逐筆實作。

**6. 下一階段建議**

1. 先取得可追溯的已報備/核准文件，裁決 legacy single-recipient adjustment 與 period-wide replay/carry-chain 的正式契約，以及 golden-domain 的矛盾定義。
2. 依核准契約修復 replay adapter/entrypoint，補真實 DB regression，重新 Prisma/build/OpenAPI/HTTP gates。
3. 補核准 golden seed（固定 ID、event-time/status/holder/plan histories、rules snapshots 與 deterministic expected results），修復 DB golden 的缺失參數條件檢查，不能讓不存在的參數 vacuously PASS。
4. 完成 148 TODO：先 identity/qualification isolation、Sponsor/Binary guardrails、Active temporal、idempotency/outbox/append-only；再逐項 deterministic economic/reversal/replay/recovery/payout fixtures。每項重大修正先 checkpoint 並重跑相關 tests。
5. React Router 主版本安全更新後，執行 browser routing/login/RBAC UAT；完整 Entra/JWKS、role tokens、BOLA/IDOR、P0/P1 UAT、integrity、backup/restore；再審核 lockfile exceptions、Docker builds 與完整 production promotion evidence。現有 promotion workflow 新增 TODO/UAT 阻擋，仍不能代替所有 live/簽核 gates。

**7. git diff 摘要**

以 df13581 比較本階段所有 commits 與未提交的最後 gate 修正，共 ${source.length} 個 source/config/policy files，另有治理報告與執行證據；詳見 final/git-diff-stat.txt／git-diff-summary.txt。
沒有修改 frozen 規則常數、Prisma schema/migrations 或原 148 TODO；沒有 merge main、force push、push、deploy 或 production monetary writes。DEV PostgreSQL 留在 healthy 狀態供下一階段使用。
完成後會 commit 最後 gate hardening 與報告，工作樹再次驗證。檢視變更須使用 git diff df13581..HEAD；完成後 plain git diff 為空。Source/config 的 git diff --check PASS；全檔 check 的 whitespace 警告只來自保留的原始命令輸出，詳見 git-diff-check-all-files.txt。

Compatibility 與安全修補依據：[Prisma 7 upgrade](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)、[DeepmergeTS advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)。其他 advisory URLs 保留於 baseline audit 輸出。
`;
fs.writeFileSync(path.join(dir, 'REPORT.md'), report);
console.log(`Report written; ${source.length} source/config files; ${todos.length} TODO; ${results.length} command records.`);
