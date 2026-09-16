# UCell Next Release Data Model / ERD
Status: DESIGN FREEZE CANDIDATE
Date: 2026-09-16

## Core references (existing, not redefined)
Person(personId), Qualification(qualificationId), SponsorHistory, BinaryHistory, Product/Order/Core monetary entities remain authoritative.

## Identity & Compliance tables
### PersonMembership
personId PK/FK; membershipState NETWORK_MEMBER|FORMAL_PENDING|FORMAL_MEMBER; stateVersion; effectiveAt; updatedAt. Prefer append-only state history via PersonMembershipHistory(id,personId,fromState,toState,reasonCode,occurredAt,actorId,correlationId).

### ProviderIdentity
id PK; personId FK; provider; issuer; subject; emailHint?; linkedAt; unlinkedAt?; status; UNIQUE(provider,issuer,subject).

### ContractDocumentVersion
id; contractType; version; contentHash; effectiveFrom; effectiveTo?; requiredAudience; status; storageRef/documentRef; approvedBy; approvedAt.

### ConsentEvidence
id; personId; contractVersionId; consentedAt; channel; evidenceHash; ipFingerprint?; userAgentClass?; correlationId. No raw unnecessary telemetry.

### OTPChallenge
id; registrationSessionId?; personId?; purpose; destinationFingerprint; providerRef?; createdAt; expiresAt; attemptCount; resendCount; verifiedAt?; lockedAt?; status. Never raw OTP.

### DeliveryProfile
id; personId; recipientName; mobileEncrypted?; phoneEncrypted?; postalCode; countryCode; region; city; addressEncrypted; effectiveFrom; effectiveTo?; updatedAt.

### FormalMemberApplication
id; personId; status; applicationVersion; createdAt; submittedAt?; reviewedAt?; reviewerId?; decisionReasonCode?; correlationId.
FormalMemberApplicationSnapshot(id,applicationId,snapshotHash,createdAt,encryptedPayloadRef/versioned normalized fields).

### KycDocument
id; applicationId; documentType; objectKey; checksum; mimeType; byteSize; uploadedAt; verificationState; retentionClass; deletedAt?; no public URL.

### KycReviewEvidence
id; applicationId; reviewerId; action; reasonCode?; noteRef?; occurredAt; evidenceHash.

### BankAccountIdentity
id; personId; bankCode; accountCiphertext/tokenRef; accountLast4; accountHolderCiphertext; verificationState; effectiveFrom; effectiveTo?; createdAt; auditRef.

## Growth tables
### ReferralLink
id; tokenHash UNIQUE; referrerQualificationId FK; contentVersionId?; campaignId?; activityId?; createdAt; expiresAt?; status; policyVersion.

### ReferralAttribution
id; anonymousId?; personId?; referrerQualificationId; referralLinkId; firstTouchAt; lastTouchAt; lockedUntil; status; sourceContentVersionId?; campaignId?; activityId?; version.
Indexes personId,status and anonymousId,status.

### ReferralAttributionHistory
id; attributionId; action CREATED|TOUCH_RECORDED|EXPIRED|REPLACED|BOUND_TO_PERSON|INVALIDATED; previousReferrerQualificationId?; newReferrerQualificationId?; occurredAt; reasonCode; referralLinkId?; correlationId. Append-only.

### SystemAssignmentPolicy
id; version; effectiveFrom; effectiveTo?; eligiblePoolSelector; tieBreakStrategy; capacityPolicy; exclusionPolicy; lockStrategy; configHash; approvalRef; status.

### Content / ContentVersion
Content(id,type,status,createdBy,createdAt). ContentVersion(id,contentId,version,title,summary,bodyRef?,mediaObjectKey?,externalUrl?,thumbnailObjectKey?,audiencePolicy,sharePolicy,publishFrom?,publishTo?,approvedBy?,approvedAt?,contentHash).

### Activity
id; title; descriptionRef; venue; onlineUrl?; startsAt; endsAt; registrationFrom; registrationTo; capacity?; waitlistPolicy; audiencePolicy; organizerId; status; createdAt.
ActivityRegistration(id,activityId,personId,qualificationId?,currentStatus,registeredAt,idempotencyIdentity); active uniqueness enforced by policy.
ActivityRegistrationHistory(id,registrationId,fromStatus?,toStatus,occurredAt,actorId?,reasonCode?,correlationId).

### MessagePublication
id; category; title; bodyRef; link?; audienceDefinition; publishFrom; publishTo?; senderId; status; createdAt; approvedBy?; audienceSnapshotHash?.
MessageAudienceSnapshot(id,publicationId,personId,qualificationId?,resolvedAt,segmentReason).
MessageDelivery(id,publicationId,personId,deliveredAt,status, UNIQUE(publicationId,personId)).
MessageReadEvidence(id,deliveryId,readAt, UNIQUE(deliveryId) if first-read semantics).
MessageActionEvidence(id,deliveryId,actionType,targetRef?,occurredAt,eventId).

## Analytics tables
AnalyticsEvent(eventId PK,eventType,schemaVersion,occurredAt,ingestedAt,personId?,qualificationId?,anonymousId?,sessionId?,referralAttributionId?,referralCode?,contentVersionId?,campaignId?,activityId?,messagePublicationId?,orderId?,productId?,source,channel,metadataJson,correlationId).
AnalyticsProjectionCheckpoint(projectorName PK,projectionVersion,lastEventCursor,lastOccurredAt?,updatedAt,status).
MetricDefinition(metricId,version,name,numeratorDefinition,denominatorDefinition,sourceDefinition,timeGrain,timezone,inclusionPolicy,exclusionPolicy,nullPolicy,effectiveFrom,effectiveTo?,hash).
NaslPolicyVersion(id,version,definitionsJson,effectiveFrom,effectiveTo?,hash,approvalRef).
NaslCurrentSnapshot(asOf,policyVersion,scopeType,scopeId?,newCount,activeCount,suspendCount,lostCount,projectionVersion).
NaslTransition(periodStart,periodEnd,policyVersion,fromState,toState,count,projectionVersion).
NaslCohort(cohortKey,ageMonth,policyVersion,total,active,suspend,lost,retainedRate?,projectionVersion).
SonarThresholdPolicy(id,version,thresholdsJson,effectiveFrom,effectiveTo?,hash,approvalRef).
SponsorSonarProjection(rootQualificationId,generation,periodStart,periodEnd,qualificationCount,newCount,activeCount,suspendCount,lostCount,repurchaseCount,pv,rpv,epv,engagementValue?,projectionVersion,asOf).
BinarySonarProjection(rootQualificationId,side,generation,periodStart,periodEnd,qualificationCount,activeCount,newCount,suspendCount,volume?,carry?,repurchaseCount,projectionVersion,asOf).
OrganizationHealthPolicy(id,version,weightsJson,thresholdsJson,effectiveFrom,effectiveTo?,hash,approvalRef).
OrganizationHealthSnapshot(rootQualificationId,periodStart,periodEnd,policyVersion,totalScore,componentsJson,asOf,projectionVersion).

## Relationship summary
Person 1:N ProviderIdentity/Consent/OTP/KYC Applications/BankIdentity/DeliveryProfile.
Person 1:N Qualification (existing Core).
Qualification 1:N ReferralLink; ReferralAttribution points to provisional referrer Qualification.
Content 1:N ContentVersion; ReferralLink may reference ContentVersion.
Activity 1:N Registration; Person 1:N Registration.
Publication 1:N AudienceSnapshot/Delivery; Delivery -> Read/Actions.
AnalyticsEvent references entities but owns no business truth.

## DB invariants
Historical/evidence tables append-only. Effective histories use non-overlapping half-open intervals where applicable. PII encrypted/tokenized; analytics avoids PII. Foreign keys never permit cascade deletion of historical monetary/consent/KYC/audit evidence. Production migrations forward-only.