# Stage deployment contract

`deploy-stage.ps1` provisions or updates the isolated Azure Stage environment. It does not promote Production.

The GitHub `stage` environment must provide these secrets:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`: federated deployment identity.
- `STAGE_POSTGRES_ADMIN_PASSWORD`: Stage-only PostgreSQL administrator password.
- `STAGE_LINE_LOGIN_CHANNEL_ID`, `STAGE_LIFF_ID`: formal Stage LINE Login/LIFF configuration when available.
- `STAGE_ENTRA_TENANT_ID`, `STAGE_ENTRA_CLIENT_ID`, `STAGE_ENTRA_REDIRECT_URI`: formal Stage Entra configuration when available.

Every run builds a commit/run-specific image tag, resolves the ACR digest, deploys the digest URI, and emits the image, revision, migration execution and health evidence as JSON. Existing Container Apps are updated with a new revision suffix. Migration and health polling are bounded and any failed Azure/Docker operation terminates the run.

Admin and Member use separate CSP files. Their configured Stage API origin is injected during the image build; Admin permits Entra identity endpoints and Member permits LINE identity endpoints.

The output deliberately reports identity settings as `OPERATIONAL_CREDENTIAL_PENDING`. Non-empty values prove configuration presence only; formal LINE and Entra verification requires the credential-backed E2E gates.

Before any deployment, run:

```powershell
node deployment/stage-preflight.mjs
```
