# Retail Referral DB Fixture Contract

The rollback-only harness must create all authoritative inputs in one Serializable transaction:

1. Effective runtime parameter `award.pending.days` for a test-only RuleVersion.
2. Effective Person and Referrer Qualification, including plan/status history and optional ActivePeriod.
3. WEB_MEMBER purchaser Person with no effective Qualification.
4. Paid retail Order and OrderLine, with immutable `RetailReferralOrderLineSnapshot` whose rate/base/version are asserted after recognition.
5. Leased `WEB_MEMBER_RETAIL_PAYMENT_CONFIRMED` outbox event.

Assertions:

- active Referrer: exactly one `RETAIL_REFERRAL` Award with `netPaidItemAmount × snapshot.rate`;
- inactive Referrer: exactly one zero-payable Award marked ineligible;
- duplicate lease: no second Award;
- no GPV/PV/Binary/Sponsor edge is created;
- every case ends in rollback and leaves no fixture rows.

Return cases extend the same source Award and assert append-only lifecycle/recovery rows; original Award monetary fields are never updated.
