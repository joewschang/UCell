const fs = require("node:fs");
const path = require("node:path");
const {execFileSync} = require("node:child_process");
const target = path.resolve(process.argv[2]);
if (fs.existsSync(target) && fs.readdirSync(target).length) throw Error("Build context must be empty");
fs.mkdirSync(target, {recursive:true});
for (const name of ["Dockerfile","patch.cjs","verify.cjs","verify-report.cjs","patch-directory.cjs","verify-directory.cjs","patch-payout-verification.cjs"]) {
  fs.copyFileSync(path.join(__dirname,name), path.join(target,name));
}
fs.copyFileSync(path.resolve(__dirname,"../../../backend/apps/api/src/modules/order/manual-payment-review.ts"), path.join(target,"manual-payment-review.ts"));
fs.copyFileSync(path.resolve(__dirname,"../../../backend/apps/api/src/modules/member/formal-review-directory.ts"), path.join(target,"formal-review-directory.ts"));
fs.copyFileSync(path.resolve(__dirname,"../../../backend/packages/database/src/compensation-audit-runner.ts"), path.join(target,"compensation-audit-runner.ts"));
execFileSync(process.execPath,[path.join(__dirname,"report.cjs"),"--prepare",path.join(target,"report.cjs")],{stdio:"inherit"});
