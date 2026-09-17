# Terminology audit and migration vocabulary

Authority: [Volume Class Clarification](../sa-decisions/R1_0B_VOLUME_CLASS_CLARIFICATION_20260917.md), [Decision v3](../sa-decisions/decisions.json), Boundary Decisions and [Issue addenda](evidence/ISSUE_2_SNAPSHOT.md). Changes in this phase are documentation/specification wording only. No production labels/API/schema identifiers are renamed.

## 1. Approved vocabulary

| Term | Domain meaning | UX label / forbidden inference |
|---|---|---|
| Person | natural person identity; may own many Balls | 會員／自然人; not a single Qualification or Person-wide Active |
| Qualification / Ball | independent economic/organizational identity | 經營資格（球）; show immutable ID and business code separately |
| Company Principal | explicit company owner / business Sponsor identity | 公司主體; not three fake Persons |
| Company Ball | explicitly COMPANY-owned Qualification for effective interval | 公司球, Always Active（公司制度）; never detect by name |
| BinaryTreeId / TreeCode / TreeName | immutable ID / stable non-reused business code / audited display name | IDs not interchangeable; rename does not create new tree |
| #1–#7 | canonical positions within one tree | TreeCode + position; not global QualificationNo |
| Founding position / Ball | #4–#7 available slot / actual occupant | 創始會員位置／該位置的球; no special rate, Active or benefit |
| Sponsor | independent referral edge and historical Sponsor recipient | 推薦; never infer from Binary parent |
| Binary Parent | immediate placement ancestor and LEFT/RIGHT | 二元安置上層; not necessarily Sponsor |
| Active | effective economic eligibility state | 本月 Active / 公司 Always Active; not RecordStatus EFFECTIVE, FORMAL_MEMBER or subscription success |
| PV | abstract Point/Performance Volume class | class metadata only; not a fourth concrete bonus-bearing amount |
| BV | abstract/reserved Business Volume class | R1.0B 無直接獎金公式; no artificial recognition to fill a UI box |
| GPV | concrete General PV | 一般業績（GPV） |
| RPV | concrete Repurchase PV | 重購業績（RPV）; distinguish eligible-consumption currency accumulator |
| EPV | concrete Excess PV | 超額業績（EPV）; monthly approved formula, not returnAmount*60% shortcut |
| Pair PV | legacy named authoritative paired general-performance measure | 本週配對業績（Pair PV）with concrete basis/evidence; not an abstract PV award |
| Carry | Qualification/position side volume carried by settlement/replay | 左／右 Carry（結算結轉）; not cash, Person balance or client sum |
| Theory / final / payable / paid | different stages, not additive accounts | 理論計算／最終權益／可支付／已支付 |
| PENDING_45D / PENDING45D | legacy enum for approved fixed payout-batch hold | 待入帳批次; explain nominal/adjusted date, never timestamp+45*24h |
| Reservoir A | undistributed Global remainder accrual | A：Global 未分配餘額; separate ledger, no automatic outflow |
| Reservoir B | company final entitlement accrual | B：公司球收益累計; not member payout or K subsidy |
| Replay adjustment | append-only signed correction | 重算調整; negative B correction is not a new discretionary outflow |
| Cumulative / selected month | through asOf / original recognition calendar month | 累積／所選月份; show Taipei and knowledgeCutoff when historical |
| New Ball | first effective placement in subtree/month | 當月新球; owner transfer/exit is not creation |

New screens show three concrete GPV/RPV/EPV fields. PV/BV may appear in educational class metadata or exact historical raw evidence, never as five equivalent concrete monetary metrics. Preserve raw enum/field names in technical drawers where necessary, alongside semantic labels. Avoid currency formatting for volume/Carry.

## 2. Audited current occurrences and next-phase impact

The full line-level scan is [terminology-hits.json](evidence/terminology-hits.json), covering Member/Admin/API/OpenAPI/shared/docs in the scanned source roots. Long source lines are clipped in the inventory and point to the original file. Not every occurrence is an error: formulas, immutable enum names and historical quotes may legitimately retain legacy identifiers.

| Current source / symbol | Finding | Required future action / validation |
|---|---|---|
| `member/src/App.tsx` Home/Performance | displayed `PV`, RPV, EPV metrics and English technical console copy | use 一般/重購/超額業績 only after backend basis corrected; human task labels |
| `member/src/terminology.ts` awardStatusLabels | `PENDING45D: 45日等待期` | label fixed payout waiting batch and show authoritative nominal/adjusted dates; no enum rewrite required |
| same file qualificationActiveLabel | Active described as `資格狀態：有效/未有效` | distinguish monthly Active from persistent Qualification lifecycle/status |
| `member/src/api.ts`, `memberData.ts` | legacy `pv` response field | typed compatibility adapter; no blind `pv -> gpv` alias until evidence confirms source |
| `backend/.../member/member-read.service.ts::volumes` | loops `PV`, RPV, EPV, whereas current recognition emits GPV | authoritative source correction belongs next phase; a label-only fix would conceal missing GPV |
| `backend/.../member/member-view.dto.ts` | Dashboard/Performance/Product `pv`; checkout description says no PV | v2 concrete nullable facts and class explanation; v1 compatibility/deprecation, regenerate OpenAPI later |
| `backend/openapi.generated.json` member schemas | public `pv`, operational ledger `/ledger/pv`, legacy statuses | leave stable v1 routes/enum identifiers; add semantic descriptions and v2 contracts after review |
| `admin/.../qualifications/QualificationDetail.tsx` | tab `PV/RPV/EPV`, raw balances keyed pvType | concrete performance summary; raw historical `pvType` evidence remains technical detail |
| `admin/.../organization/OrganizationPage.tsx` | distinct trees already explained, GPV/Pair/Carry cited | retain separation; add tree/position identity and authoritative unit/period labels |
| `shared/design-system/index.tsx` lifecycle/metrics | reusable components expose raw stage/value concepts | semantic labels provided by one mapping; null state must remain distinct |
| `backend/.../recognition-active.ts::epvAfter` | accumulator field currently equals cumulative amount | never label as final EPV; reviewed contract must expose actual Core EPV evidence |
| `backend/.../worker/src/main.ts` threshold source | 1200 default and GPV snapshot basis | source conflict audit, not wording authorization to change threshold |
| `governance/sa-decisions/R1_0B_CORE_LOGIC_ADDENDUM_v2.md` §§2/8/11 | older concrete PV/BV, literal 45D and pending cut-off language | superseded only by explicit v3/Boundary/Volume decisions; do not rewrite historical decision evidence |
| `governance/sa-decisions/REPORT.md` | older report lists then-pending rules/implementation | treat as historical phase report; current closure cites newer decisions and code |

## 3. Documentation authority correction for this specification set

Use the later explicit rulings when interpreting old documents: v3 SA-13 makes PV/BV abstract; SA-14/Boundary fixes Sunday and 10/25 00:00 Taipei; SA-15 fixes nominal payout batches/business-day roll; SA-19 fixes generation traversal (no stop/compression/substitution); Boundary sets A accrual/no outflow and qualification succession. These corrections appear in all new docs. Do not mechanically search-replace GPV/PV/BV in historical fixtures, source event names, hashes or signed decisions.

A 10th batch nominal payout is following-month 25th; a 25th batch is month-after-next 10th, then next business day if needed. Show actual stored calendar evidence, not frontend date arithmetic. Weekly x4 cap is reference only, not a new monthly cap or payout prediction.

## 4. Tooltip copy contracts

一般業績：依有效制度認列的一般業績，詳見來源與期間。重購業績：正式重購認列資料，與消費款項及 Active 條件分別顯示。超額業績：依該球當月合格消費與正式 EPV 規則認列。公司球：公司持有期間依公司制度 Always Active，收益歸 Reservoir B。創始位置：本樹 #4–#7 的安置位置，不提供額外獎金或 Active 特權。Carry：所選結算／重算提供的左右結轉業績。Reservoir A：Global 未分配餘額。Reservoir B：公司球經正式計算後的權益累計，現階段僅入帳與來源調整。平衡比：營運分析指標，不參與獎金計算。

Tooltips supplement concise labels; all critical distinctions remain visible without hover. Explain links use exact scope/source, not a generic narrative that implies current facts for a historical query.

## 5. Acceptance and limits

Future terminology checks cover strings, tooltips, docs, DTO descriptions and generated OpenAPI. Test that only three concrete summary metrics appear; company pages omit NT$2,000 progress; pending never displays NT$0; founding label creates no entitlement; A/B remain separate; raw evidence retains exact original field/value; no generic PV/BV reaches Award/Ledger calculation. Historical GPV IDs/amounts and all Golden economic outputs must be unchanged by semantic refactoring.

This Phase updates specification vocabulary only. Production/API wording and source conflicts remain explicitly tracked next-phase work, not silently marked fixed.

## AI / management terminology

Management NASL A is Person engagement under a versioned management policy; it is not Qualification financial Active. Explain means presenting stored authoritative facts, not recalculation. FINALIZED does not mean PAID. Reservoir B corrections are signed economic adjustments, not approved outflow. AI suggestions are recommendations, never settlement evidence. Knowledge citations require effective version; unsupported historical answers show 目前無法取得可驗證資料. Register display terms and metric IDs centrally as proposed in [AI-ready](AI_READY_FOUNDATION_SPEC.md).
