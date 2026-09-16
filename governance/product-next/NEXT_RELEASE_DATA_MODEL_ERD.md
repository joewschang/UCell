# UCell Next Release Data Model / ERD
Status: DESIGN FREEZE CANDIDATE
Date: 2026-09-17

## Core references
Person(personId), Qualification(qualificationId), SponsorHistory, BinaryHistory, Product/Order/Core monetary entities remain authoritative. Three relationship domains remain separate: Person referral, Ball Sponsor Tree, Ball Binary Tree.

## Membership / referral
### PersonMembership
personId PK/FK; membershipState NETWORK_MEMBER|FORMAL_PENDING|FORMAL_MEMBER; stateVersion; effectiveAt; updatedAt.
PersonMembershipHistory(id,personId,fromState,toState,reasonCode,occurredAt,actorId,correlationId) append-only.

### MemberReferralRelationship
id; referredPersonId; referrerPersonId; sourceFirstQualificationId; sourceSponsorQualificationId; effectiveAt; ruleVersion; evidenceId; status. The ordinary first formal referral is historical and later Ball sponsor choices do not update it.

### MemberReferralCode
id; personId; code/tokenHash UNIQUE; defaultReferralQualificationId?; enabledFrom; enabledTo?; status; policyVersion. Code is Person-owned but may resolve to a default/applicable Ball context.

### FormalMembershipActivationEvidence
id; personId; qualifyingOrderId; qualifyingOrderLineId?; packageType STARTER|ELITE|LEADER (map to authoritative product codes); firstQualificationId; finalSponsorQualificationId; referrerPersonId; contractEvidenceRef; kycEvidenceRef; ruleVersion; effectiveAt; evidenceHash.

## Identity & Compliance
ProviderIdentity(id,personId,provider,issuer,subject,linkedAt,unlinkedAt?,status, UNIQUE(provider,issuer,subject)). Current LINE enabled; OTP/Google future feature-disabled.
ContractDocumentVersion(id,contractType,version,contentHash,effectiveFrom,effectiveTo?,requiredAudience,status,storageRef,approvedBy,approvedAt).
ConsentEvidence(id,personId,contractVersionId,consentedAt,channel,evidenceHash,correlationId).
OTPChallenge retained for future purposes; never raw OTP.
DeliveryProfile(id,personId,recipientName,mobile/phone/address protected fields,effectiveFrom,effectiveTo?).
FormalMemberApplication(id,personId,status,applicationVersion,createdAt,submittedAt?,reviewedAt?,reviewerId?,decisionReasonCode?,correlationId).
FormalMemberApplicationSnapshot(id,applicationId,snapshotHash,createdAt,encryptedPayloadRef).
KycDocument(id,applicationId,documentType,objectKey,checksum,mimeType,byteSize,uploadedAt,verificationState,retentionClass,deletedAt?).
KycReviewEvidence(id,applicationId,reviewerId,action,reasonCode?,noteRef?,occurredAt,evidenceHash).
BankAccountIdentity(id,personId,bankCode,accountCiphertext/tokenRef,accountLast4,accountHolderCiphertext,verificationState,effectiveFrom,effectiveTo?,createdAt,auditRef).

## Qualification setup / placement
### QualificationSetup
qualificationId PK/FK; ownerPersonId; qualifyingOrderId; packageType; setupStatus PURCHASE_PENDING|PURCHASED|BALL_SETUP_PENDING|PLACEMENT_PENDING|PLACEMENT_OVERDUE|PLACED|ACTIVE (mapping must reconcile with existing Core lifecycle); provisionalAttributionId?; finalSponsorQualificationId?; placementRequestedAt?; placementDueAt?; placedAt?; setupPolicyVersion.

### QualificationSponsorSelectionEvidence
id; qualificationId; attributionReferrerPersonId?; attributionReferrerQualificationId?; selectedSponsorQualificationId; selectedSponsorOwnerPersonId; selectedByPersonId; selectedAt; source ATTRIBUTION_PREFILL|MANUAL_INPUT|SYSTEM_ASSIGNMENT; policyVersion; correlationId. Final Sponsor edge remains Core SponsorHistory.

### PlacementEvidence
id; qualificationId; sponsorQualificationId; binaryParentQualificationId; side; placedByType SPONSOR_OWNER|ADMIN_OVERRIDE|SYSTEM_AUTO; placedByPersonId?; placedAt; reasonCode?; policyVersion; previousStatus; correlationId; evidenceHash.

### PlacementEscalationEvidence
id; qualificationId; dueAt; escalatedAt; escalationType OVERDUE_72H|MANUAL_REVIEW; status; assignedAdminId?; resolvedAt?; resolutionPlacementEvidenceId?; correlationId.

### SystemAssignmentPolicy
id; version; effectiveFrom; effectiveTo?; eligiblePoolSelector; tieBreakStrategy; capacityPolicy; exclusionPolicy; lockStrategy; configHash; approvalRef; status.
SystemAssignmentPoolEntry(id,policyVersion/systemPoolVersion,qualificationId,enabledFrom,enabledTo?,priorityClass,capacityLimit?,status,approvalRef).

## Growth / referral attribution
ReferralLink(id,tokenHash UNIQUE,referrerPersonId,referrerQualificationId?,contentVersionId?,campaignId?,activityId?,createdAt,expiresAt?,status,policyVersion).
ReferralAttribution(id,anonymousId?,personId?,referrerPersonId,referrerQualificationId?,referralLinkId,firstTouchAt,lastTouchAt,lockedUntil,status,sourceContentVersionId?,campaignId?,activityId?,version).
ReferralAttributionHistory(id,attributionId,action,previous/new referrer Person/Qualification refs as applicable,occurredAt,reasonCode,referralLinkId?,correlationId) append-only.
Attribution is provisional/prefill; final Sponsor selection may differ and is separately evidenced.

## CMS / Activities / Inbox
Content(id,type,status,createdBy,createdAt); ContentVersion(id,contentId,version,title,summary,bodyRef?,mediaObjectKey?,externalUrl?,thumbnailObjectKey?,audiencePolicy,sharePolicy,publishFrom?,publishTo?,approvedBy?,approvedAt?,contentHash).
Activity(id,title,descriptionRef,venue,onlineUrl?,startsAt,endsAt,registrationFrom,registrationTo,capacity?,waitlistPolicy,audiencePolicy,organizerId,status,createdAt).
ActivityRegistration(id,activityId,personId,qualificationId?,currentStatus,registeredAt,idempotencyIdentity); ActivityRegistrationHistory append-only.
MessagePublication(id,category,title,bodyRef,link?,audienceDefinition,publishFrom,publishTo?,senderId,status,createdAt,approvedBy?,audienceSnapshotHash?). MessageAudienceSnapshot/MessageDelivery/MessageReadEvidence/MessageActionEvidence as previously defined.

## Analytics / monitoring
AnalyticsEvent remains append-only and excludes KYC/bank PII.
Add QualificationPlacementMonitorProjection(qualificationId,ownerPersonId,packageType,sponsorQualificationId,sponsorOwnerPersonId,requestedAt,dueAt,ageBucket,status,interventionStatus,asOf,projectionVersion).
Other MetricDefinition/NASL/SponsorSonar/BinarySonar/OrganizationHealth projections remain as approved.

## Relationship summary
Person 1:N Qualification.
Person referral is Person->Person via MemberReferralRelationship.
Sponsor Tree is Qualification->Qualification via Core SponsorHistory.
Binary Tree is Qualification->Qualification via Core BinaryHistory.
Ball #2+ may use another eligible Ball owned by the same Person as Sponsor without changing MemberReferralRelationship.
Sponsor selection grants placement authority to Sponsor Ball owner; placement target is a separately validated Binary parent/side.

## DB invariants
No Sponsor or Binary self-edge/cycle. Ownership equality across two different Balls is allowed. Placement commit locks/revalidates new Ball and target slot. Historical/evidence tables append-only. PII encrypted/tokenized. No cascade deletion of historical monetary/consent/KYC/referral/placement evidence. Production migrations forward-only.