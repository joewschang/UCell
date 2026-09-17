import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const deploy = read('deployment/deploy-stage.ps1');
const workflow = read('.github/workflows/deploy-stage.yml');
const adminDockerfile = read('deployment/Dockerfile.admin');
const memberDockerfile = read('deployment/Dockerfile.member');
const adminNginx = read('deployment/nginx.admin.conf');
const memberNginx = read('deployment/nginx.member.conf');
const uatManifest = JSON.parse(read('backend/scripts/stage-uat-seed-manifest.json'));

const assertions = [
  ['backend LINE configuration name', deploy.includes('LINE_LOGIN_CHANNEL_ID=$LineLoginChannelId')],
  ['backend Entra tenant wiring', deploy.includes('ENTRA_TENANT_ID=$EntraTenantId')],
  ['backend Entra client wiring', deploy.includes('ENTRA_CLIENT_ID=$EntraClientId')],
  ['inventory warehouse fails closed and is wired', deploy.includes("Parameter(Mandatory)") && deploy.includes('UCELL_INVENTORY_WAREHOUSE_ID=$InventoryWarehouseId') && workflow.includes('vars.UCELL_INVENTORY_WAREHOUSE_ID')],
  ['inventory policy fails closed and is wired', deploy.includes('UCELL_INVENTORY_POLICY_VERSION=$InventoryPolicyVersion') && workflow.includes('vars.UCELL_INVENTORY_POLICY_VERSION')],
  ['UAT manifest warehouse is a valid configured warehouse candidate', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/i.test(uatManifest.warehouse.warehouseId)],
  ['omitted identity configuration is removed on update', deploy.includes("'--remove-env-vars'") && deploy.includes("$serverRemove+='LINE_LOGIN_CHANNEL_ID'")],
  ['immutable ACR digest resolution', deploy.includes('Resolve-Image') && deploy.includes('@$digest')],
  ['existing Container App update path', deploy.includes("'containerapp','update'")],
  ['unique revision suffix', deploy.includes("'--revision-suffix',$revisionSuffix")],
  ['bounded migration polling', deploy.includes('$MigrationPollAttempts') && !deploy.includes('do {')],
  ['health and revision evidence', deploy.includes('ApiHealth') && deploy.includes("'containerapp','revision','show'")],
  ['credential status is not falsely verified', !deploy.includes('CredentialsVerified') && deploy.includes("VerificationStatus='OPERATIONAL_CREDENTIAL_PENDING'")],
  ['workflow uses immutable run tag', workflow.includes("${{ github.sha }}-${{ github.run_id }}-${{ github.run_attempt }}")],
  ['workflow uses backend LINE variable name', workflow.includes('STAGE_LINE_LOGIN_CHANNEL_ID') && !workflow.includes('STAGE_LINE_CHANNEL_ID')],
  ['admin image uses admin CSP', adminDockerfile.includes('nginx.admin.conf') && adminDockerfile.includes('CSP_API_ORIGIN')],
  ['member image uses member CSP', memberDockerfile.includes('nginx.member.conf') && memberDockerfile.includes('CSP_API_ORIGIN')],
  ['admin CSP permits configured API and Entra only', adminNginx.includes('__API_ORIGIN__') && adminNginx.includes('login.microsoftonline.com') && !adminNginx.includes('api.line.me')],
  ['member CSP permits configured API and LINE only', memberNginx.includes('__API_ORIGIN__') && memberNginx.includes('api.line.me') && memberNginx.includes('access.line.me') && !memberNginx.includes('microsoftonline.com')],
];

const failures = assertions.filter(([, pass]) => !pass).map(([name]) => name);
if (failures.length) {
  console.error(`STAGE_PREFLIGHT_FAIL: ${failures.join('; ')}`);
  process.exit(1);
}
console.log(`STAGE_PREFLIGHT_PASS: ${assertions.length} deployment assertions`);
