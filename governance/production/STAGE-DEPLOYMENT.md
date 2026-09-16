# UCell isolated Stage deployment

Stage is a disposable pre-production environment. It must use a separate resource group, PostgreSQL database, identity configuration, secrets, storage, and Container Apps environment from Production.

## Deployment

Prerequisites: Azure CLI login, Docker with Linux container support, Contributor access to the target subscription, and a PowerShell session at the repository root.

```powershell
.\deployment\deploy-stage.ps1 -ResourceGroup rg-ucell-stage -Location eastasia
```

The script provisions Azure Container Registry, PostgreSQL 16 Flexible Server, Container Apps Environment, Key Vault, Storage Account, Log Analytics, and Application Insights. It builds and deploys API, Worker, Admin, and Member images with mock mode and Admin auth bypass disabled.

Formal LINE and Entra values are optional for infrastructure validation. When absent, identity gates remain `OPERATIONAL_CREDENTIAL_PENDING`; synthetic values must never be recorded as a formal PASS.

## Production reset

Do not promote or rename Stage resources. Production must be deployed into a separate resource group with new PostgreSQL credentials, Key Vault secrets, LINE channel/LIFF configuration, Entra application registrations, deployment identity, storage, and telemetry resources. Run migrations, restore drill, Security E2E, UAT, shadow settlement, and manual Go/No-Go against the intended Production configuration before enabling payout.

Production deployment remains protected and disabled.

The manual GitHub workflow `.github/workflows/deploy-stage.yml` supports OIDC login and the protected `stage` environment. It requires `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, and `STAGE_POSTGRES_ADMIN_PASSWORD`; LINE and Entra Stage credentials remain optional until issued and never imply a formal credential PASS.
