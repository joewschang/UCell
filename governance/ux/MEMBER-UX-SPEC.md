# Member UX-1

Mobile-first reference widths 375/390/430 plus 768 tablet. Bottom navigation remains 首頁／組織／商城／獎金／我的. No routes removed.

Dashboard: authoritative member identity, qualification badge, Core repurchase status/details, PV/RPV/EPV, pending monetary state and service shortcuts. Notifications retains existing connected page/link; dashboard preview is not invented.

QualificationSwitcher uses Backend-confirmed QualificationContext. Only after successful POST confirmation show 已切換至 code｜ball. During switching private views remain unmounted; failed/foreign selection remains fail closed. Rank/code/ball shown in selector, current context repeated on Organization and Bonus. Loading/error/session/no-qualification semantics retained.

Organization: separate Sponsor and Binary queries/tabs. Existing masked sponsor/referrals and server left/right counts/volumes retained. Complete tree nodes, GPV semantics and Carry are unavailable in current Member read contract; do not substitute counts or derive carry. Full viewer zoom/pan/search/depth is deferred until authoritative API exists.

Bonus: explicit lifecycle status, nullable money, period query and append-only ledger history. Diagram is a lifecycle legend with only explicit current status; missing effective/payable/paid timestamps are not inferred. No historic ledger edit action.

Commerce, notifications, profile, repurchase and logout remain Connected implementations. Visual harness uses explicit MOCK ONLY fixtures for repeatable screenshots; HTTP/DB Golden and BOLA tests run independently against real isolated DB. Actual LINE/LIFF device verification remains Operational Credential Pending.
