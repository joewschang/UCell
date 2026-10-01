# Member message producer acceptance matrix — 2026-10-01

Source authority: §33 MSG-1 examples apply where the corresponding governed domain event exists; §34 and the full implementation progress retain the complete integration/UX scope. This is a current-source audit, not a waiver or an assertion that every category is complete.

| Family | Actual current producer / proof | Remaining acceptance |
|---|---|---|
| Order/payment | MEMBER_ORDER_CREATED Outbox → processMemberOrderNotification posts order creation only | Commerce payment-status producer and full source/browser routing |
| Fulfillment/shipment | Verified serial bindShipment dispatch/delivery → personal purchaser message; 4 suites/31 tests | Wider provider-to-source/browser and Person-only retail order routing |
| Repurchase monthly recognition / Active | Actual API + Worker sealed RPV recognition → qualification message; 4 suites/29 tests; /repurchase route/month control now exists | Other Active-source producer events and full actual backend/browser acceptance |
| Award/Payable/Payout | Governed payment-result writer → qualification message, real protected payout history endpoint; 7 suites/53 tests, full gate185/1346 | Award/Payable readiness producers and complete notification-to-source actual backend/browser journey |
| Qualification/achievement | Growth renders stored facts and milestones; no dedicated Qualification message producer found in current writer search | Governed producer, dedupe/privacy/source and browser acceptance |
| Task/service follow-up | Core audited task workflow exists; no personal producer found in current task writers | Member-audience policy and source-backed producer/journeys |
| Learning/course | Personal enrollment/completion, assignment and daily reminders; actual outreach browser evidence | Wider applicable-content/assessment and integration/UX matrix |
| Event registration/attendance | Registration/cancellation/attendance and personal reminders with retirement/cycle guards; actual outreach browser evidence | Wider integration and UX matrix |
| Member-specific operational | Generic immutable personal message API is not proof of every business producer | Map each applicable governed operation to its own audience/source evidence |

All personalized producers are UCell only; generic category names, successful webhook or access-token configuration do not prove actual LINE delivery or domain coverage. Original audiences are immutable after posting, and current qualification access is rechecked. Current whole-batch implementation/recertification remains IN_PROGRESS; Stage RC NOT_READY. No deployment or broadcast.
