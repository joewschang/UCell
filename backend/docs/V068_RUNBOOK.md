# v0.6.8 DEV / CI Runbook

## Local DEV prerequisites
- Node.js 22
- pnpm 9
- PostgreSQL 16
- DATABASE_URL

## Commands
```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
cp .env.example .env
bash scripts/dev-smoke.sh
```

For Release Candidate:
```bash
pnpm -r build
bash scripts/rc-gate.sh
```

## Important
Do not use `prisma migrate reset` on any shared or production-like environment.
R1.0B historical ledger facts must not be casually destroyed.
