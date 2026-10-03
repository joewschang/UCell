import {ApiProperty} from '@nestjs/swagger';

/** Owner-scoped persisted Growth facts. No internal identity or browser-derived economics. */
export class GrowthCoverage {
 @ApiProperty({"type":"integer","minimum":0}) learningItems!:number;
 @ApiProperty({"type":"integer","minimum":0}) eventItems!:number;
 @ApiProperty({"type":"integer","minimum":0,"enum":[100]}) itemLimit!:number;
 @ApiProperty({"type":"integer","minimum":0,"enum":[20]}) milestoneLimit!:number;
 @ApiProperty({"type":"string","enum":["ALL_PERSON_RECORDS"]}) counts!:string;
}
export class GrowthMilestone {
 @ApiProperty({"type":"string"}) type!:string;
 @ApiProperty({"type":"string"}) title!:string;
 @ApiProperty({"type":"string","format":"date-time"}) occurredAt!:string;
 @ApiProperty({"type":"string"}) reference!:string;
 @ApiProperty({"type":"string"}) link!:string;
}
export class GrowthQualificationItem {
 @ApiProperty({"type":"string","pattern":"^[0-9]+$","description":"Public lossless qualification number; never an internal UUID."}) qualificationNo!:string;
 @ApiProperty({"type":"string","nullable":true}) ballNo!:string|null;
 @ApiProperty({"type":"string","nullable":true}) planLevelCode!:string|null;
 @ApiProperty({"type":"string"}) status!:string;
 @ApiProperty({"type":"string","format":"date-time","nullable":true}) effectiveAt!:string|null;
}
export class GrowthQualification {
 @ApiProperty({type:[GrowthQualificationItem]}) items!:GrowthQualificationItem[];
 @ApiProperty({"type":"string"}) explanation!:string;
}
export class GrowthActiveItem {
 @ApiProperty({"type":"string","pattern":"^[0-9]+$","description":"Public lossless qualification number; never an internal UUID."}) qualificationNo!:string;
 @ApiProperty({"type":"boolean"}) active!:boolean;
 @ApiProperty({"type":"string","format":"date-time","nullable":true}) activeFrom!:string|null;
 @ApiProperty({"type":"string","format":"date-time","nullable":true}) activeTo!:string|null;
}
export class GrowthActive {
 @ApiProperty({"type":"integer","minimum":0}) activeQualificationCount!:number;
 @ApiProperty({"type":"integer","minimum":0}) totalQualificationCount!:number;
 @ApiProperty({"type":"string","pattern":"^[0-9]{4}-[0-9]{2}$"}) monthReference!:string;
 @ApiProperty({type:[GrowthActiveItem]}) items!:GrowthActiveItem[];
 @ApiProperty({"type":"string"}) explanation!:string;
}
export class GrowthRankAchievement {
 @ApiProperty({"type":"string","pattern":"^[0-9]+$","description":"Public lossless qualification number; never an internal UUID."}) qualificationNo!:string;
 @ApiProperty({"type":"string"}) rankCode!:string;
 @ApiProperty({"type":"string","format":"date-time"}) achievedAt!:string;
 @ApiProperty({"type":"string","format":"date-time"}) sourcePeriodEnd!:string;
}
export class GrowthRankProgressItem {
 @ApiProperty({"type":"string","pattern":"^[0-9]+$","description":"Public lossless qualification number; never an internal UUID."}) qualificationNo!:string;
 @ApiProperty({"type":"string","enum":["RECORDED","UNAVAILABLE","HIGHEST_ACHIEVED"]}) status!:string;
 @ApiProperty({"type":"string","nullable":true}) rankCode!:string|null;
 @ApiProperty({"type":"string","format":"date-time","nullable":true}) periodStart!:string|null;
 @ApiProperty({"type":"string","format":"date-time","nullable":true}) periodEnd!:string|null;
 @ApiProperty({"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$","description":"Server projection from verified original closed-period evidence; never a browser economic calculation.","nullable":true}) weakSidePv!:string|null;
 @ApiProperty({"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$","description":"Server projection from verified original closed-period evidence; never a browser economic calculation.","nullable":true}) thresholdPv!:string|null;
 @ApiProperty({"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$","description":"Server projection from verified original closed-period evidence; never a browser economic calculation.","nullable":true}) remainingPv!:string|null;
 @ApiProperty({"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$","description":"Server projection from verified original closed-period evidence; never a browser economic calculation.","nullable":true}) progressPercent!:string|null;
 @ApiProperty({"type":"boolean","nullable":true}) activeAtClose!:boolean|null;
}
export class GrowthRankProgress {
 @ApiProperty({"type":"string","enum":["RECORDED","UNAVAILABLE","HIGHEST_ACHIEVED"]}) status!:string;
 @ApiProperty({"type":"string","enum":["ORIGINAL_CLOSED_PERIOD"]}) basis!:string;
 @ApiProperty({"type":"string"}) reason!:string;
 @ApiProperty({type:[GrowthRankProgressItem]}) items!:GrowthRankProgressItem[];
}
export class GrowthGlobalRank {
 @ApiProperty({type:[GrowthRankAchievement]}) achieved!:GrowthRankAchievement[];
 @ApiProperty({type:GrowthRankProgress}) nextAchievement!:GrowthRankProgress;
 @ApiProperty({"type":"string"}) explanation!:string;
}
export class GrowthOrganization {
 @ApiProperty({"type":"integer","minimum":0,"description":"Distinct current effective sponsor relationships; no child identity or volume disclosure."}) directQualifiedCount!:number;
 @ApiProperty({"type":"string"}) explanation!:string;
}
export class GrowthScheme {
 @ApiProperty({"type":"string","pattern":"^[0-9]+$","description":"Public lossless qualification number; never an internal UUID."}) qualificationNo!:string;
 @ApiProperty({"type":"string","enum":["ACTIVE","PENDING","NONE"]}) status!:string;
 @ApiProperty({"type":"string","format":"date-time","nullable":true}) startMonth!:string|null;
 @ApiProperty({"type":"string","format":"date-time","nullable":true}) endMonth!:string|null;
}
export class GrowthRecognitionCounts {
 @ApiProperty({"type":"integer","minimum":0,"description":"Count of stored schedule status across all schemes of currently held Qualifications; not independent economic recertification."}) SCHEDULED!:number;
 @ApiProperty({"type":"integer","minimum":0,"description":"Count of stored schedule status across all schemes of currently held Qualifications; not independent economic recertification."}) DUE!:number;
 @ApiProperty({"type":"integer","minimum":0,"description":"Count of stored schedule status across all schemes of currently held Qualifications; not independent economic recertification."}) RECOGNIZED!:number;
 @ApiProperty({"type":"integer","minimum":0,"description":"Count of stored schedule status across all schemes of currently held Qualifications; not independent economic recertification."}) CANCELLED!:number;
 @ApiProperty({"type":"integer","minimum":0,"description":"Count of stored schedule status across all schemes of currently held Qualifications; not independent economic recertification."}) REVERSED!:number;
}
export class GrowthRecognitionItem {
 @ApiProperty({"type":"string","pattern":"^[0-9]+$","description":"Public lossless qualification number; never an internal UUID."}) qualificationNo!:string;
 @ApiProperty({"type":"string","enum":["PENDING","ACTIVE","SUSPENDED","CANCELLED","COMPLETED"]}) schemeStatus!:string;
 @ApiProperty({"type":"string"}) startMonth!:string;
 @ApiProperty({"type":"string"}) endMonth!:string;
 @ApiProperty({"type":"integer","minimum":1}) installmentNo!:number;
 @ApiProperty({"type":"string"}) month!:string;
 @ApiProperty({"type":"string","enum":["SCHEDULED","DUE","RECOGNIZED","CANCELLED","REVERSED"]}) status!:string;
 @ApiProperty({"type":"string","format":"date-time"}) dueAt!:string;
 @ApiProperty({"type":"string","format":"date-time","nullable":true,"description":"Stored timestamp, not inferred from scheme status. Consult recordConsistency."}) recognizedAt!:string|null;
 @ApiProperty({"type":"string","enum":["RECORDED","UNAVAILABLE"],"description":"RECOGNIZED with missing/future timestamp is unavailable. RECORDED describes schedule record consistency, not a ledger seal."}) recordConsistency!:string;
 @ApiProperty({"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$","description":"Stored decimal string; never a browser economic calculation."}) scheduledAmount!:string;
 @ApiProperty({"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$","description":"Stored decimal string; never a browser economic calculation."}) scheduledRpv!:string;
}
export class GrowthRecognition {
 @ApiProperty({type:GrowthRecognitionCounts}) counts!:GrowthRecognitionCounts;
 @ApiProperty({"type":"integer","minimum":0,"enum":[100]}) itemLimit!:number;
 @ApiProperty({type:[GrowthRecognitionItem]}) items!:GrowthRecognitionItem[];
}
export class GrowthRepurchase {
 @ApiProperty({type:[GrowthScheme]}) items!:GrowthScheme[];
 @ApiProperty({type:GrowthRecognition}) recognition!:GrowthRecognition;
 @ApiProperty({"type":"string"}) explanation!:string;
}
export class GrowthLearningItem {
 @ApiProperty({"type":"string"}) courseCode!:string;
 @ApiProperty({"type":"string"}) title!:string;
 @ApiProperty({"type":"string"}) status!:string;
 @ApiProperty({"type":"integer","minimum":0}) completedLessonCount!:number;
 @ApiProperty({"type":"string","format":"date-time","nullable":true}) completedAt!:string|null;
}
export class GrowthLearning {
 @ApiProperty({"type":"integer","minimum":0}) enrolledCount!:number;
 @ApiProperty({"type":"integer","minimum":0}) completedCount!:number;
 @ApiProperty({type:[GrowthLearningItem]}) items!:GrowthLearningItem[];
 @ApiProperty({"type":"string"}) explanation!:string;
}
export class GrowthEventItem {
 @ApiProperty({"type":"string"}) eventCode!:string;
 @ApiProperty({"type":"string"}) title!:string;
 @ApiProperty({"type":"string"}) status!:string;
 @ApiProperty({"type":"string"}) eventStatus!:string;
 @ApiProperty({"type":"string","format":"date-time"}) startsAt!:string;
 @ApiProperty({"type":"string","format":"date-time","nullable":true}) checkedInAt!:string|null;
 @ApiProperty({"type":"string","format":"date-time","nullable":true}) attendedAt!:string|null;
}
export class GrowthEvents {
 @ApiProperty({"type":"integer","minimum":0}) upcomingRegisteredCount!:number;
 @ApiProperty({"type":"integer","minimum":0}) attendedCount!:number;
 @ApiProperty({"type":"integer","minimum":0}) checkedInCount!:number;
 @ApiProperty({type:[GrowthEventItem]}) items!:GrowthEventItem[];
 @ApiProperty({"type":"string"}) explanation!:string;
}
export class GrowthDimensions {
 @ApiProperty({type:GrowthQualification}) qualification!:GrowthQualification;
 @ApiProperty({type:GrowthActive}) active!:GrowthActive;
 @ApiProperty({type:GrowthGlobalRank}) globalRank!:GrowthGlobalRank;
 @ApiProperty({type:GrowthOrganization}) organization!:GrowthOrganization;
 @ApiProperty({type:GrowthRepurchase}) repurchase!:GrowthRepurchase;
 @ApiProperty({type:GrowthLearning}) learning!:GrowthLearning;
 @ApiProperty({type:GrowthEvents}) events!:GrowthEvents;
}
export class MemberGrowthView {
 @ApiProperty({"type":"string","format":"date-time"}) asOf!:string;
 @ApiProperty({type:GrowthCoverage}) coverage!:GrowthCoverage;
 @ApiProperty({type:[GrowthMilestone]}) milestones!:GrowthMilestone[];
 @ApiProperty({type:GrowthDimensions}) dimensions!:GrowthDimensions;
}
export const memberGrowthModels=[GrowthCoverage,GrowthMilestone,GrowthQualificationItem,GrowthQualification,GrowthActiveItem,GrowthActive,GrowthRankAchievement,GrowthRankProgressItem,GrowthRankProgress,GrowthGlobalRank,GrowthOrganization,GrowthScheme,GrowthRecognitionCounts,GrowthRecognitionItem,GrowthRecognition,GrowthRepurchase,GrowthLearningItem,GrowthLearning,GrowthEventItem,GrowthEvents,GrowthDimensions,MemberGrowthView];
