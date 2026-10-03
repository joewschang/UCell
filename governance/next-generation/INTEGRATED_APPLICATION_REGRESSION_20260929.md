# Integrated application regression — 2026-09-29

Source baseline: `461122c5e0cc1f5349ad5f1990316b6209a29e60`, tested in the retained detached checkout `C:/UCell/worktrees/period-control-validation-b435666`. The directory name is historical; HEAD was advanced to the stated baseline before this run. This includes parameterized Compensation Period aging and governed close stages, which the earlier `b435666` aggregate did not cover.

Dependencies were installed from the committed Admin/Member lockfiles with `--frozen-lockfile --ignore-scripts`. Backend dependencies and the generated Prisma client were already present in the isolated checkout. All backend packages rebuilt successfully.

## Member regression repair

The initial Member run failed 11 assertions across three files and reported two unhandled errors. Two test harnesses mounted App without the ThemeProvider that the production entry point already provides; the profile's theme control therefore failed during rendering. Navigation tests treated link children as plain strings even though links now contain a decorative icon and nested label.

The two mounted journeys now use the real ThemeProvider. Navigation assertions collect nested label text while excluding aria-hidden decorative content. Existing five-section labels, active-section mapping, qualification access boundaries, profile/registration content and logout assertions remain intact. No production UI or business behavior changed.

## Completed checks

- Recursive backend production build: PASS.
- Admin: 39 files / 148 tests, TypeScript check and production build PASS.
- Member after the three test-only repairs: 31 files / 175 tests, TypeScript check and production build PASS; no unhandled test errors.
- Shared package: 5 suites / 181 tests PASS.
- Schema, migration, OpenAPI, security-policy and test-TODO preflights: PASS.
- Full isolated API at the stated baseline: 152 suites / 1,143 tests PASS (268.554 seconds), fresh 0→109 migrations, 162 baseline real-database assertions, `API_JEST_ISOLATED_PASS` and `API_JEST_ISOLATED_CLEANUP_PASS`.

Worker, database and contracts package test scripts are placeholders and are not counted as test coverage. Real Worker/database behavior is exercised by the isolated API suites. Admin's build reports a non-fatal bundle-size advisory; Member tests report React Router future-flag advisories.

Logs are under `C:/UCell/logs/`: `integrated-461122c-backend-build.log`, `integrated-461122c-admin.log`, `integrated-461122c-member.log` (initial failure), `integrated-461122c-member-fixed.log`, `integrated-461122c-shared.log`, `integrated-461122c-preflights.log`, and `integrated-461122c-api.log`.

This is a local automated regression checkpoint, not full functional closure or browser acceptance. Remaining calendar/late-input orchestration, Welfare/Payable sequencing and other authorized queue items stay open. No feature was enabled and no Stage/Production deployment was performed; Stage remains NOT READY.
