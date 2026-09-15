# Dependency Lock Policy

Connected DEV now contains a generated `pnpm-lock.yaml`. Generation and installation
do not constitute production approval; review and all connected gates remain required.

In a connected DEV environment:
1. use Node.js 24.x and pnpm 12.4.1,
2. run dependency resolution once,
3. review `jose` and all transitive dependency versions,
4. generate `pnpm-lock.yaml`,
5. commit/freeze the lockfile,
6. rerun all build/security/database gates with `pnpm install --frozen-lockfile`.

A release artifact without a reviewed lockfile must fail Release Preparation.
