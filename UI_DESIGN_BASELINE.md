# UCell — accepted Member and Admin homepage design baseline

Both designs are included together in `feature/member-liff-mvp`. The user's
instruction to include both changes adopts them as the development design
baseline; it does not authorize merging main or production deployment.

| Surface | Adopted design | Implementation | Evidence checkpoint |
| --- | --- | --- | --- |
| Member authenticated home | Luminous Midnight: midnight blue, ice cyan and restrained violet; digital membership card, scoped metrics and service shortcuts | `member/src/tech-home.css`, `member/src/App.tsx` | `31c814314557a1af59e51880af40d2aa5b3ee8db`; Member CI `35101236750` PASS |
| Admin authenticated dashboard | Midnight Current: dark operations console, count cards, active-qualification ring and role-filtered work queues | `admin/src/features/dashboard/`, `admin/src/app/AppShell.tsx` | `b1d15b4a82d24b28bd0258307fa1b853d8eca350`; Admin CI `35099402046` PASS |

The Member checkpoint already contains the Admin changes. There is no separate
copy or unmerged design patch to apply. The two homepage themes are route-scoped;
other pages retain their existing appearance. The previous warm Member homepage
is superseded by Luminous Midnight, while shared styles remain in use elsewhere.

Both CI workflows watch this baseline file, allowing the same combined commit to
be checked by Member and Admin builds and isolated browser flows.

## Preserved behavior and limits

- Person/Qualification isolation, existing authentication and permission checks,
  real API sources, null/pending financial values and mock-data labeling remain.
- Admin's ring uses valid activeQualifications / qualifications counts; no
  invented revenue, growth, health metrics or production-readiness claims.
- R1.0B, backend business logic, migrations and payment behavior are unchanged.
- Browser screenshots use synthetic data. Real LINE/Entra device integration,
  backend/DB release gates and production promotion remain separate requirements.
- No main merge, public deployment or RC promotion is part of this acceptance.

Details: [Member design](member/docs/TECH_HOME.md) ·
[Admin design](admin/docs/DASHBOARD_DESIGN.md).
