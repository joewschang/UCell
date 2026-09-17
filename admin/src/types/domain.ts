export type UUID=string;
export type PlanLevel='STARTER'|'ELITE'|'LEADER';
export type QualificationStatus='DRAFT'|'EFFECTIVE'|'SUSPENDED'|'CLOSED'|'VOIDED'|'EXITED';
export type ApplicationStatus='DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED'|'EFFECTIVE';
export type SideCode='LEFT'|'RIGHT';
export type OrderPurpose='ENTRY'|'RETAIL'|'REPURCHASE'|'SUBSCRIPTION_PREPAY'|'UPGRADE';
export type BonusAwardType='REFERRAL'|'EQUALIZATION'|'BINARY'|'MATCHING'|'RPV'|'EPV'|'GLOBAL';
export interface V3Evidence {ruleVersion:string|null;parameterSnapshotHash:string|null;evidenceHash:string|null}
export interface ReservoirAEffect extends V3Evidence {id:UUID;effectType:string;amount:string;sourceGlobalSettlementId:UUID;sourcePeriodStart:string;sourcePeriodEnd:string;replayActionKey:string|null;createdAt:string}
export interface ReservoirAProjection {reservoirCode:'A';balance:string;effects:ReservoirAEffect[];limit:number;truncated:boolean}

export interface Person {
  personId:UUID;
  legalName:string;
  preferredName?:string|null;
  birthDate?:string|null;
  mobile?:string|null;
  email?:string|null;
  status?:string;
  createdAt?:string;
}
export interface Qualification {
  qualificationId:UUID;
  qualificationNo?:string|number;
  currentHolderPersonId:UUID;
  planLevelCode:PlanLevel;
  status:QualificationStatus;
  activeFlag:boolean;
  effectiveAt?:string|null;
  currentHolder?:Person;
  sponsorRelation?:any;
  binaryPlacement?:any;
}
export interface MembershipApplication {
  applicationId:UUID;
  personId:UUID;
  requestedPlanLevelCode:PlanLevel;
  sponsorQualificationId?:UUID|null;
  binaryParentQualificationId?:UUID|null;
  binarySide?:SideCode|null;
  status:ApplicationStatus;
  submittedAt?:string|null;
  approvedAt?:string|null;
  effectiveAt?:string|null;
  createdQualificationId?:UUID|null;
  note?:string|null;
  createdAt:string;
  person:Person;
  qualification?:Qualification|null;
  sponsorQualification?:Qualification|null;
  binaryParentQualification?:Qualification|null;
}
export interface ProductReference {
  productId:UUID;
  sku:string;
  displayName:string;
  currentPrice:string;
  currency:string;
  isActive:boolean;
  ruleProfiles?:Array<{productRuleProfileId:string;gpvRate:string;pvRate?:string|null;ruleVersionCode:string}>;
}
export interface OrderLine {
  orderLineId?:UUID; productId:UUID; skuSnapshot?:string; productNameSnapshot?:string;
  quantity:string; unitPrice?:string; lineAmount?:string; gpvAmountSnapshot?:string;
}
export interface Order {
  orderId:UUID; orderNo?:string|number; qualificationId:UUID; purpose:OrderPurpose;
  status:string; grossAmount:string; netAmount:string; createdAt:string; paidAt?:string|null;
  qualification?:Qualification; lines:OrderLine[]; paymentEvents?:any[];
}
export interface PlacementPreview {
  valid:boolean; nextSponsorSequenceNo?:number; firstThirdLeftRequired?:boolean;
  code?:string;message?:string;side?:SideCode;
  sponsor?:any;binaryParent?:any;
}
