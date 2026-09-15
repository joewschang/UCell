# Dependency Lock Policy

The current source packages do not yet contain a generated `pnpm-lock.yaml`.
That is acceptable for this offline source-generation stage, but **not acceptable for an RC or production release**.

In a connected DEV environment:
1. install the approved pnpm 9.x toolchain,
2. run dependency resolution once,
3. review `jose` and all transitive dependency versions,
4. generate `pnpm-lock.yaml`,
5. commit/freeze the lockfile,
6. rerun all build/security/database gates with `pnpm install --frozen-lockfile`.

A release artifact without a reviewed lockfile must fail Release Preparation.
