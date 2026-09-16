# UCell Formal Member / Ball Placement Golden Journeys
Status: ACCEPTANCE BASELINE
Date: 2026-09-17

## Golden A — First Ball with referral
1 LINE-authenticated Person is NETWORK_MEMBER.
2 Person has valid 30-day referral attribution to Member A / A-Q2; UI prefills A-Q2.
3 Person purchases eligible membership package 啟航/菁英/領袖 through authoritative Order/Payment flow.
4 Required formal contract/data/KYC conditions complete under policy.
5 Create first Qualification B-Q1 in setup state.
6 Member may keep A-Q2 or manually change to another valid Sponsor Ball before confirmation.
7 Backend validates final Sponsor Ball; suppose A-Q2 remains final.
8 Persist Sponsor selection evidence and Core Sponsor edge B-Q1 -> A-Q2.
9 Establish Person B member referrer = owner(A-Q2)=A with immutable evidence.
10 Person can become FORMAL_MEMBER when qualifying purchase + formal requirements are satisfied; B-Q1 may still be PLACEMENT_PENDING.
11 owner(A-Q2) receives pending placement authority for B-Q1.
12 placementRequestedAt recorded; dueAt=+72h.
13 Sponsor owner chooses legal Binary parent/side; Backend transaction locks/revalidates.
14 Persist Binary history + PlacementEvidence; B-Q1 becomes PLACED/ACTIVE according to reconciled Core lifecycle.
15 Member/Admin readback shows Person referrer A, Sponsor Ball A-Q2, Binary parent/side and who placed it.

## Golden B — Attribution differs from final Sponsor
Referral attribution prefill=A-Q2. Before confirmation buyer changes Sponsor to C-Q4. Backend validates C-Q4. Final Sponsor edge=B-Q1->C-Q4; Person referrer becomes owner(C-Q4), not A. Analytics retains attribution A/A-Q2 and final Sponsor C/C-Q4 separately. Later referral clicks cannot rewrite final Sponsor/referrer evidence.

## Golden C — Second Ball sponsored by own Ball
Person B already FORMAL_MEMBER; B.referrerMember=A; owns active B-Q1. B purchases second qualifying Ball B-Q2 and selects Sponsor=B-Q1. Backend permits because different Ball and eligible, cycle-free. B.referrerMember remains A. B owns Sponsor Ball B-Q1, therefore B may place B-Q2 into a legal Binary position. Sponsor Tree and Binary Tree evidence are independent.

## Golden D — Placement overdue/Admin intervention
B-Q1 enters PLACEMENT_PENDING at T0, dueAt=T0+72h. No placement by dueAt. System derives/transitions PLACEMENT_OVERDUE, emits escalation evidence and Admin monitor shows overdue. Authorized Admin with QUALIFICATION_PLACEMENT_OVERRIDE selects legal target, enters reason, Backend locks/revalidates and commits. PlacementEvidence.placedByType=ADMIN_OVERRIDE. Qualification activates. Audit shows Sponsor owner did not place within SLA and Admin intervention.

## Golden E — No referral/system auto
Network member buys qualifying package and no valid/manual Sponsor Ball is supplied. Approved SystemAssignmentPolicy selects eligible System Sponsor Ball deterministically. SYSTEM_AUTO BFS selects legal Binary target and commits Sponsor/Binary/placement evidence atomically as policy allows. No 72h human wait. Person-level referrer is owner of selected System Sponsor Ball according to approved first-Ball rule. PolicyVersion/hash retained.

## Golden F — Concurrent placement conflict
Sponsor owner and Admin (or two sessions) attempt same/new Ball placement concurrently. First valid transaction locks and commits. Second revalidation sees Ball already placed or target occupied and returns PLACEMENT_CONFLICT without duplicate Binary edge, lifecycle, award or evidence. Reload shows canonical result.

## Golden G — Invalid cycles
Reject sponsorBall == newBall. Reject sponsor selection creating Sponsor cycle. Reject Binary parent selection creating Binary cycle. Owning both B-Q1 and B-Q2 is not itself a cycle and does not prohibit B-Q1 sponsoring B-Q2.

## Golden H — Ordinary shopper never formal
LINE Network Member buys ordinary product only. May complete delivery address/phone and order successfully. Person remains NETWORK_MEMBER; no FormalMembershipActivationEvidence and no membership Qualification is created.

## Required assertions
Person referral, Sponsor Tree and Binary Tree are independently queryable and consistent. Formal Membership activation references qualifying package evidence. Placement before ACTIVE where required. 72h deadline deterministic. Historical evidence append-only. Ball #2+ sponsor cannot mutate Person referrer. Attribution cannot silently overwrite final Sponsor. All organization mutations server-authoritative and concurrency-safe.