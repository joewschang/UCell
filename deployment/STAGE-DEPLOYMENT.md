# Stage deployment contract

`deploy-stage.ps1` provisions or updates the isolated Azure Stage environment. It does not promote Production.

The GitHub `stage` environment must provide these secrets:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`: federated deployment identity.
- `STAGE_POSTGRES_ADMIN_PASSWORD`: Stage-only PostgreSQL administrator password.
- `STAGE_PII_ENCRYPTION_KEY`: Stage-only base64-encoded 32-byte encryption key used for encrypted Member delivery and formal-application fields. It is injected into Container Apps as a secret reference and is never a frontend build argument.
- `STAGE_LINE_LOGIN_CHANNEL_ID`, `STAGE_LIFF_ID`: formal Stage LINE Login/LIFF configuration when available.
- `STAGE_ENTRA_TENANT_ID`, `STAGE_ENTRA_CLIENT_ID`, `STAGE_ENTRA_REDIRECT_URI`: formal Stage Entra configuration when available.
- `STAGE_UAT_MEMBER_TOKEN`: a Stage-only UAT token. It is injected as an API secret and embedded only in the Stage Member UAT build, where it is limited to the fixed synthetic Stage UAT member. It is never accepted outside `UCELL_ENVIRONMENT=STAGE` with `NODE_ENV=staging`.
- GitHub environment variables `UCELL_INVENTORY_WAREHOUSE_ID` and `UCELL_INVENTORY_POLICY_VERSION` are mandatory. Deployment fails before Azure access when either is empty or invalid.

Every run builds a commit/run-specific image tag, resolves the ACR digest, deploys the digest URI, and emits the image, revision, migration execution and health evidence as JSON. Existing Container Apps are updated with a new revision suffix. Migration and health polling are bounded and any failed Azure/Docker operation terminates the run.

Admin and Member use separate CSP files. Their configured Stage API origin is injected during the image build; Admin permits Entra identity endpoints and Member permits LINE identity endpoints.

The output deliberately reports identity settings as `OPERATIONAL_CREDENTIAL_PENDING`. Non-empty values prove configuration presence only; formal LINE and Entra verification requires the credential-backed E2E gates.

Before any deployment, run:

```powershell
node deployment/stage-preflight.mjs
```

## Optional UAT seed

The Stage workflow runs the UAT seed only after a successful migration, with the exact opt-in `UCELL_STAGE_UAT_SEED_OPT_IN=SEED_STAGE_UAT_V1`. It accepts only `UCELL_ENVIRONMENT=STAGE`, an Azure PostgreSQL host, and database name `ucell_stage`. Validation occurs before Prisma is loaded or a connection is opened. Localhost, production-like targets, destructive arguments, reset, and drop are rejected.

```powershell
$env:UCELL_ENVIRONMENT='STAGE'
$env:UCELL_STAGE_UAT_SEED_OPT_IN='SEED_STAGE_UAT_V1'
$env:DATABASE_URL='<stage-only connection string>'
pnpm --dir backend stage:uat:seed
```

The fixed manifest creates or reuses one minimal Person, Qualification, product, DRAFT order, Warehouse, InventoryItem, and InventoryBalance. Set `UCELL_INVENTORY_WAREHOUSE_ID` to the manifest warehouse ID (`51000000-0000-4000-8000-000000000006`) so the worker uses that inventory. Re-running the seed is idempotent and does not reset an existing balance. It creates no payment, award, payable, PV ledger, settlement, or Golden fixture facts. Review `backend/scripts/stage-uat-seed-manifest.json` before an authorized Stage run.

The same explicit Stage UAT mode enables the existing non-production Admin demo login and builds the Member frontend with the `?uat=A` entry for the fixed synthetic member. The API keeps the token restricted to Stage and the synthetic member; Production always keeps Admin bypass disabled and does not accept the Stage token.
