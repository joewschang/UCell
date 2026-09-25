# UCell R1.0B Production RC1

Release date: 2026-09-10  
Rule version: **R1.0B FROZEN**  
Backend source baseline: **v0.6.10-R6 UAT/Security/Release Preparation**  
Admin source baseline: **v0.6.0 UAT/Security/Release Preparation**

## Release meaning

This repository is the consolidated **Production Release Candidate source package** for UCell R1.0B. It contains the Admin frontend, Backend API/Worker, database migrations, security/UAT/release gates and production deployment scaffolding.

It is intentionally **fail-closed**: production promotion is prohibited until the connected CI/DEV environment has produced a reviewed `pnpm-lock.yaml` and all database, security, UAT, backup/restore and RC gates pass.

## Current Ball Number rule

[Ball Number V2 — per-tree sequence](governance/next-generation/BALL_NUMBER_SEQUENCE_V2.md) supersedes the position-derived ordinary Ball numbering rule from 2026-09-25. Company bootstrap numbers and existing published numbers remain unchanged.

## SSOT governance

Economic rules come from UCell R1.0B FROZEN. Source of truth order:
1. Applicable law / regulator-approved filing.
2. R1.0B FROZEN SSOT.
3. Rule Registry / Parameter Snapshot.
4. Backend deterministic implementation.
5. Admin, LINE OA, AI explanations and education material.

AI is **not** permitted to calculate or write monetary results. Deterministic Rule Engine owns PV, awards, settlement, recovery and payout outcomes.

## Repository layout

- `backend/` — NestJS API + Worker + Prisma/PostgreSQL + migrations + gates.
- `admin/` — React/Vite Admin UI + Entra login + RBAC UX + UAT console.
- `deployment/` — production compose, environment template, backup/restore and smoke scripts.
- `governance/` — SSOT/spec/AI/release alignment artifacts.
- `.github/workflows/` — connected CI/RC workflows.

## Required promotion gates

Run `scripts/release-gate.sh` in a connected DEV/CI environment. No production deployment if any P0/UAT/security/database/backup gate fails or is not run.
