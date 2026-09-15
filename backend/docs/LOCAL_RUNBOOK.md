# Local Development Runbook

## Prerequisites
- Node.js maintained LTS
- Corepack / pnpm
- Docker Desktop / Docker Engine
- PostgreSQL 16 container

## Start
```bash
cp .env.example .env
corepack enable
corepack prepare pnpm@9 --activate
pnpm install
docker compose up -d postgres
pnpm --filter @ucell/database prisma generate
pnpm --filter @ucell/database prisma migrate deploy
pnpm --filter @ucell/database prisma db seed
pnpm dev
```

Worker:
```bash
pnpm --filter @ucell/worker start:dev
```

Swagger:
- http://localhost:3000/docs

Health:
- GET http://localhost:3000/api/v1/health

## Important
The full canonical Annotated PostgreSQL definition remains the master DB architecture.
This v0.2.0 repository implements only the first vertical slice and its native guardrails.
Before production, reconcile this Prisma schema with the full SQL migration set.
