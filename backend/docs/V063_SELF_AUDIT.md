# v0.6.3 Self Audit

1. Timezone is now explicit; UTC-week shortcut is no longer the production target.
2. Qualification remains the payout operating unit, preserving multi-ball isolation.
3. Recovery never rewrites the original award.
4. Partial Recovery across multiple payout batches is NOT yet production-complete:
   an outstanding-balance projection is required in v0.6.4.
5. JWT signature verification and LINE Login verification are NOT yet implemented.
6. No claim is made that Prisma validate, TypeScript compile or PostgreSQL migration has run successfully in this build environment.
7. Monday is currently a parameter seed, not a hard-coded legal conclusion. It must be confirmed against the final operational settlement definition before production.
