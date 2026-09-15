# v0.6.2 Self Audit

## Corrected from v0.6.1
- A later refund reversal was previously filtered out of an older period by reversal occurred_at.
  Fixed using original-event economic attribution.
- A returned qualification's GPV affects Binary ancestors, not primarily its own Binary subtree.
  Fixed by discovering all Binary ancestors.
- Changing Binary total theory may alter K1 for all recipients.
  Fixed by period-wide K1 replay.
- Changing Binary Paid may alter Matching theory and K2 for all recipients.
  Fixed by period-wide Matching/K2 replay.
- v0.6.0 migration referenced a non-existent `commerce.subscription`.
  Patched before first production migration.
- v0.6 Prisma schema had drift from migrations.
  Adjustment/workflow/replay models are now represented.
- RPV reversal used EPV as a technical award type.
  Added dedicated RPV award type.

## Not hidden
- The current helper derives weekly boundaries using UTC Sunday-based calculation inherited from the prototype.
  Before production, settlement timezone/week definition must be made an explicit R1.0B operational parameter.
- No claim of successful npm compile or PostgreSQL migration execution is made in this environment.
