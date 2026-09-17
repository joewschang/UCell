import {ApiProperty} from '@nestjs/swagger';

export class V3EvidenceView {
 @ApiProperty({type:String,nullable:true}) ruleVersion!:string|null;
 @ApiProperty({type:String,nullable:true}) parameterSnapshotHash!:string|null;
 @ApiProperty({type:String,nullable:true}) evidenceHash!:string|null;
}
export class ReservoirAEffectView extends V3EvidenceView {
 @ApiProperty({format:'uuid'}) id!:string;
 @ApiProperty() effectType!:string;
 @ApiProperty({description:'Authoritative signed decimal string.'}) amount!:string;
 @ApiProperty({format:'uuid'}) sourceGlobalSettlementId!:string;
 @ApiProperty({format:'date-time'}) sourcePeriodStart!:string;
 @ApiProperty({format:'date-time'}) sourcePeriodEnd!:string;
 @ApiProperty({type:String,nullable:true}) replayActionKey!:string|null;
 @ApiProperty({format:'date-time'}) createdAt!:string;
}
export class ReservoirAView {
 @ApiProperty({enum:['A']}) reservoirCode!:'A';
 @ApiProperty({description:'Authoritative sum of append-only effects as a decimal string.'}) balance!:string;
 @ApiProperty({type:[ReservoirAEffectView]}) effects!:ReservoirAEffectView[];
 @ApiProperty() limit!:number;
 @ApiProperty() truncated!:boolean;
}
