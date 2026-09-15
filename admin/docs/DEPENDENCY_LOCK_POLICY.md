# Admin Dependency Lock Policy

Admin v0.6.0 adds `@azure/msal-browser`.
A reviewed lockfile is mandatory before RC/production.

Connected DEV steps:
1. use Node.js 24.x and pnpm 12.4.1,
2. resolve dependencies,
3. generate `pnpm-lock.yaml`,
4. review the resolved MSAL/transitive versions,
5. freeze the lockfile,
6. run `pnpm install --frozen-lockfile`,
7. typecheck/build/test before deployment.

Connected DEV contains a generated lockfile; production approval still requires review and complete gate evidence.
