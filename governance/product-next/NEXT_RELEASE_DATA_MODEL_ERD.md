# UCell Next Release Data Model / ERD
Status: DESIGN FREEZE CANDIDATE
Date: 2026-09-17

## Core references
Person, Qualification, SponsorHistory, BinaryHistory, ProductProfile/Product version, Order/Core monetary entities remain authoritative. Person referral, Ball Sponsor Tree and Ball Binary Tree are independent.

## Membership / referral
PersonMembership + append-only history as approved.
MemberReferralRelationship(referredPersonId,referrerPersonId,sourceFirstQualificationId,sourceSponsorQualificationId,effectiveAt,ruleVersion,evidenceId,status).
MemberReferralCode(personId,code/tokenHash,defaultReferralQualificationId?,effective/status/policy fields).
FormalMembershipActivationEvidence(personId,qualifyingOrderId,qualifyingOrderLineId?,packageVersionId,firstQualificationId,finalSponsorQualificationId,referrerPersonId,contractEvidenceRef,kycEvidenceRef,ruleVersion,effectiveAt,evidenceHash).

## Configurable package domain
### PackageProfile
id; stableCode; packageClass QUALIFICATION|ACTIVE_DURATION|FUTURE; createdAt; status identity-level metadata.

### PackageProfileVersion
id; packageProfileId; version; displayName; currency; priceAmount; selectableProductQuantity; selectionMode EXACT_QUANTITY (initial); membershipEffect; qualificationEffect; activeDurationUnit?; activeDurationValue?; targetQualificationRequired; memberEligibilityPolicyRef?; salesFrom?; salesTo?; effectiveFrom; effectiveTo?; status DRAFT|SCHEDULED|ACTIVE|RETIRED; recognitionConfigRef?; configHash; createdBy; approvedBy?; approvedAt?. Published/used versions immutable.

Initial configured versions: 啟航 14,400/3; 菁英 43,200/9; 領袖 72,000/15; 季活躍 6,000/2; 半年活躍 12,000/4; 年活躍 24,000/8. These are seed/config facts, not hardcoded enum parameters.

### PackageSelectableProduct
id; packageVersionId; productProfileId/productVersionPolicyRef; enabledFrom; enabledTo?; minQty?; maxQty?; selectionIncrement default 1; sortOrder; status. Defines server-authoritative product pool.

### PackagePurchaseSnapshot
id; orderId; orderLineId?; personId; targetQualificationId?; packageVersionId; packageCode; packageName; packageClass; currency; priceAmount; selectableProductQuantity; membershipEffect; qualificationEffect; activeDuration snapshot?; recognitionConfigRef/hash; packageConfigHash; purchasedAt. Immutable.

### PackagePurchaseSelection
id; packagePurchaseSnapshotId; productProfileId; productVersionId/SKUVersionRef; quantity; productDisplaySnapshot?; unitRetailPriceSnapshot?; productConfigHash. Sum quantity must satisfy snapshot selection mode/quantity. Historical selection immutable.

## Identity & Compliance
ProviderIdentity current LINE; OTP/Google future feature-disabled. ContractDocumentVersion, ConsentEvidence, DeliveryProfile, FormalMemberApplication/Snapshot, KycDocument/ReviewEvidence, BankAccountIdentity remain as approved with protected PII/private storage.

## Qualification setup / placement
QualificationSetup now references `packagePurchaseSnapshotId` rather than a mutable package type where possible; ownerPersonId; qualifyingOrderId; setupStatus; provisionalAttributionId?; finalSponsorQualificationId?; placementRequestedAt/dueAt/placedAt; setupPolicyVersion. Qualification Sponsor Selection/Placement/Escalation/SystemAssignment evidence remain as Batch 3.

## Active-duration entitlement
Add QualificationActiveEntitlementEvidence(id,qualificationId,packagePurchaseSnapshotId,entitlementType,periodStart,periodEnd,policyVersion,createdAt,evidenceHash,status). Exact stacking/start-date/renewal semantics come from Active-policy SSOT; purchase never creates Ball or changes Person referrer/Sponsor/Binary history.

## Growth / referral
ReferralLink/ReferralAttribution/History remain provisional marketing facts with Person + Ball context; final Sponsor may differ.

## CMS / Activities / Inbox
As approved.

## Analytics / monitoring
AnalyticsEvent excludes PII. Placement monitor remains. Add PackageSalesProjection optional read model by packageVersion/period and ProductSelectionProjection by packageVersion/product/period; analytics only, no monetary authority.

## Relationship summary
PackageProfile 1:N PackageProfileVersion. PackageProfileVersion 1:N PackageSelectableProduct. Order purchase creates immutable PackagePurchaseSnapshot 1:N PackagePurchaseSelection. QUALIFICATION package snapshot may feed QualificationSetup/FormalMembershipActivationEvidence. ACTIVE_DURATION package snapshot feeds QualificationActiveEntitlementEvidence for an existing target Qualification.

## DB invariants
Package versions used by orders cannot be edited/deleted. Selected products must be eligible under the purchased/effective package version and quantities validated server-side. Do not infer PV/BV from price or selected retail totals; explicit recognition config required. No Sponsor/Binary cycles. Historical/evidence tables append-only. PII protected. Production migrations forward-only.