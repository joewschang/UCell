# Admin Dependency Lock Policy

Admin v0.6.0 adds `@azure/msal-browser`.
A reviewed lockfile is mandatory before RC/production.

Connected DEV steps:
1. use approved pnpm 9.x,
2. resolve dependencies,
3. generate `pnpm-lock.yaml`,
4. review the resolved MSAL/transitive versions,
5. freeze the lockfile,
6. run `pnpm install --frozen-lockfile`,
7. typecheck/build/test before deployment.

This offline source package does not claim that dependency resolution has been completed.
