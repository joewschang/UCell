import {Body,Controller,Get,Headers,Param,ParseUUIDPipe,Post,Query,Req,StreamableFile,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiHeader,ApiOperation,ApiProperty,ApiPropertyOptional,ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/roles.decorator';
import {FormalMemberApplicationService,type AdminPaperFormalInput} from './formal-member-application.service';
import {FormalMembershipConflictService} from './formal-membership-conflict.service';
import {FormalKycDocumentService} from './formal-kyc-document.service';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {IsBoolean,IsDateString,IsEmail,IsIn,IsOptional,IsString,IsUUID,Matches,MaxLength,ValidateIf} from 'class-validator';

class AdminPaperFormalApplicationDto implements AdminPaperFormalInput {
 @ApiProperty({format:'uuid'}) @IsUUID() representativePersonId!:string;
 @ApiProperty({maxLength:120}) @IsString() @Matches(/\S/) @MaxLength(120) paperApplicationReference!:string;
 @ApiProperty({format:'uuid'}) @IsUUID() formalContractVersionId!:string;
 @ApiProperty({enum:['INDIVIDUAL','LEGAL_ENTITY']}) @IsIn(['INDIVIDUAL','LEGAL_ENTITY']) applicantType!:'INDIVIDUAL'|'LEGAL_ENTITY';

 @ApiPropertyOptional({maxLength:120}) @ValidateIf(o=>o.applicantType==='INDIVIDUAL') @IsString() @Matches(/\S/) @MaxLength(120) legalName?:string;
 @ApiPropertyOptional({maxLength:32}) @ValidateIf(o=>o.applicantType==='INDIVIDUAL') @IsString() @Matches(/\S/) @MaxLength(32) gender?:string;
 @ApiPropertyOptional({format:'date'}) @ValidateIf(o=>o.applicantType==='INDIVIDUAL') @IsDateString() birthDate?:string;
 @ApiPropertyOptional({example:'TW'}) @ValidateIf(o=>o.applicantType==='INDIVIDUAL') @Matches(/^[A-Z]{2}$/) nationalityCode?:string;
 @ApiPropertyOptional({enum:['NATIONAL_ID','RESIDENCE_PERMIT','PASSPORT','OTHER']}) @ValidateIf(o=>o.applicantType==='INDIVIDUAL') @IsIn(['NATIONAL_ID','RESIDENCE_PERMIT','PASSPORT','OTHER']) identityDocumentType?:'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER';
 @ApiPropertyOptional({maxLength:64}) @ValidateIf(o=>o.applicantType==='INDIVIDUAL') @IsString() @Matches(/\S/) @MaxLength(64) identityDocumentNumber?:string;

 @ApiPropertyOptional({maxLength:160}) @ValidateIf(o=>o.applicantType==='LEGAL_ENTITY') @IsString() @Matches(/\S/) @MaxLength(160) legalEntityName?:string;
 @ApiPropertyOptional({maxLength:40}) @ValidateIf(o=>o.applicantType==='LEGAL_ENTITY') @IsString() @Matches(/\S/) @MaxLength(40) legalEntityRegistrationNo?:string;
 @ApiPropertyOptional({maxLength:500}) @ValidateIf(o=>o.applicantType==='LEGAL_ENTITY') @IsString() @Matches(/\S/) @MaxLength(500) legalEntityRegisteredAddress?:string;
 @ApiPropertyOptional({example:'TW'}) @ValidateIf(o=>o.applicantType==='LEGAL_ENTITY') @Matches(/^[A-Z]{2}$/) legalEntityRegistrationCountryCode?:string;
 @ApiPropertyOptional({maxLength:120}) @ValidateIf(o=>o.applicantType==='LEGAL_ENTITY') @IsString() @Matches(/\S/) @MaxLength(120) representativeLegalName?:string;
 @ApiPropertyOptional({example:'TW'}) @ValidateIf(o=>o.applicantType==='LEGAL_ENTITY') @Matches(/^[A-Z]{2}$/) representativeNationalityCode?:string;
 @ApiPropertyOptional({enum:['NATIONAL_ID','RESIDENCE_PERMIT','PASSPORT','OTHER']}) @ValidateIf(o=>o.applicantType==='LEGAL_ENTITY') @IsIn(['NATIONAL_ID','RESIDENCE_PERMIT','PASSPORT','OTHER']) representativeIdentityDocumentType?:'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER';
 @ApiPropertyOptional({maxLength:64}) @ValidateIf(o=>o.applicantType==='LEGAL_ENTITY') @IsString() @Matches(/\S/) @MaxLength(64) representativeIdentityDocumentNumber?:string;

 @ApiProperty({default:false}) @IsBoolean() hasSpouse:boolean=false;
 @ApiPropertyOptional({maxLength:120}) @ValidateIf(o=>o.hasSpouse===true) @IsString() @Matches(/\S/) @MaxLength(120) spouseName?:string;
 @ApiPropertyOptional({example:'TW'}) @ValidateIf(o=>o.hasSpouse===true) @Matches(/^[A-Z]{2}$/) spouseNationalityCode?:string;
 @ApiPropertyOptional({enum:['NATIONAL_ID','RESIDENCE_PERMIT','PASSPORT','OTHER']}) @ValidateIf(o=>o.hasSpouse===true) @IsIn(['NATIONAL_ID','RESIDENCE_PERMIT','PASSPORT','OTHER']) spouseIdentityDocumentType?:'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER';
 @ApiPropertyOptional({maxLength:64}) @ValidateIf(o=>o.hasSpouse===true) @IsString() @Matches(/\S/) @MaxLength(64) spouseIdentityDocumentNumber?:string;

 @ApiProperty({maxLength:500}) @IsString() @Matches(/\S/) @MaxLength(500) communicationAddress!:string;
 @ApiProperty({maxLength:32}) @IsString() @Matches(/\S/) @MaxLength(32) phone!:string;
 @ApiProperty({format:'email',maxLength:254}) @IsEmail() @MaxLength(254) email!:string;
 @ApiProperty({maxLength:16}) @IsString() @Matches(/\S/) @MaxLength(16) bankCode!:string;
 @ApiProperty({maxLength:34}) @IsString() @Matches(/\S/) @MaxLength(34) bankAccount!:string;
 @ApiProperty({maxLength:120}) @IsString() @Matches(/\S/) @MaxLength(120) accountHolder!:string;
}

class AdminPaperEvidenceReviewDto {
 @ApiProperty({enum:['SIGNED_APPLICATION_AGREEMENT','IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER','CORPORATE_REGISTRATION','REPRESENTATIVE_IDENTITY_FRONT','REPRESENTATIVE_IDENTITY_BACK','CORPORATE_BANK_PROOF','TAX_REGISTRATION','OTHER']})
 @IsIn(['SIGNED_APPLICATION_AGREEMENT','IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER','CORPORATE_REGISTRATION','REPRESENTATIVE_IDENTITY_FRONT','REPRESENTATIVE_IDENTITY_BACK','CORPORATE_BANK_PROOF','TAX_REGISTRATION','OTHER'])
 evidenceType!:string;
 @ApiProperty({enum:['REVIEWED','REJECTED']}) @IsIn(['REVIEWED','REJECTED']) decision!:'REVIEWED'|'REJECTED';
 @ApiPropertyOptional({maxLength:200}) @IsOptional() @IsString() @MaxLength(200) sourceReference?:string;
 @ApiPropertyOptional({maxLength:500}) @IsOptional() @IsString() @MaxLength(500) note?:string;
}

class AdminDocumentScanDto {
 @ApiProperty({enum:['CLEAN','INFECTED','FAILED']}) @IsIn(['CLEAN','INFECTED','FAILED']) status!:'CLEAN'|'INFECTED'|'FAILED';
}

@ApiTags('Admin - Formal Member Application')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
@Controller('admin/formal-member-applications')
export class AdminFormalMemberApplicationController {
 constructor(private readonly service:FormalMemberApplicationService,private readonly conflicts:FormalMembershipConflictService,private readonly kyc:FormalKycDocumentService){}
 @Get('contracts/required')
 @ApiOperation({operationId:'adminFormalRequiredContracts',description:'List currently effective required Formal Member contract versions for back-office paper intake.'})
 requiredContracts(){return this.service.adminRequiredContracts();}
 @Post('paper') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 @ApiOperation({operationId:'adminCreatePaperFormalMemberApplication',description:'Back-office entry for paper INDIVIDUAL or LEGAL_ENTITY formal applications. Corporate applications are paper-only. Creates no Qualification/Ball.'})
 createPaper(@Body() body:AdminPaperFormalApplicationDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.createPaper(body,req.user?.personId,key,req.requestId);}
 @Get() @ApiOperation({operationId:'adminListFormalMemberApplications',description:'Read-only metadata queue. The encrypted application payload is never decrypted or returned.'})
 list(@Query('status') status?:string,@Query('take') take?:string){return this.service.adminList({status:status||undefined,take:Number(take??50)});}
 @Post(':id/paper-evidence') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 @ApiOperation({operationId:'adminReviewPaperFormalEvidence',description:'Record that an authorized operator reviewed a physical paper evidence item. Does not fabricate a digital upload.'})
 reviewPaperEvidence(@Param('id',new ParseUUIDPipe()) id:string,@Body() body:AdminPaperEvidenceReviewDto,@Req() req:any){
  return this.service.reviewPaperEvidence(id,body.evidenceType,body.decision,body.sourceReference,body.note,req.user?.personId,req.requestId);
 }
 @Post(':id/begin-review')
 @ApiOperation({operationId:'adminBeginFormalMemberReview',description:'Move a formal application into UNDER_REVIEW only after document/evidence, spouse and cross-line gates pass.'})
 beginReview(@Param('id',new ParseUUIDPipe()) id:string,@Req() req:any){return this.service.beginReview(id,req.user?.personId,req.requestId);}
 @Post(':id/approve')
 @ApiOperation({operationId:'adminApproveFormalMember',description:'Approve a fully reviewed Person or LegalEntity as FORMAL_MEMBER. Does not create a Qualification/Ball; packages are purchased separately.'})
 approve(@Param('id',new ParseUUIDPipe()) id:string,@Req() req:any){return this.service.approve(id,req.user?.personId,req.requestId);}
 @Get(':id/documents') @ApiOperation({operationId:'adminFormalApplicationDocuments',description:'List KYC document metadata for review; private storage object keys/URLs are not returned.'})
 documents(@Param('id',new ParseUUIDPipe()) id:string){return this.kyc.adminList(id);}
 @Get('documents/:documentId/content') @ApiOperation({operationId:'adminFormalApplicationDocumentContent',description:'Audited role-restricted read of one private KYC document image.'})
 async documentContent(@Param('documentId',new ParseUUIDPipe()) documentId:string,@Req() req:any){const blob=await this.kyc.adminContent(documentId,req.user?.personId,req.requestId);return new StreamableFile(blob.bytes,{type:blob.mimeType});}
 @Post('documents/:documentId/scan-result') @ApiOperation({operationId:'adminFormalApplicationDocumentScanResult',description:'Record malware/content-safety scan result. CLEAN is required by the Web formal-review gate.'})
 scanResult(@Param('documentId',new ParseUUIDPipe()) documentId:string,@Body() body:AdminDocumentScanDto,@Req() req:any){return this.kyc.recordScan(documentId,body.status,req.user?.personId,req.requestId);}
 @Get(':id/detail') @ApiOperation({operationId:'adminFormalMemberApplicationDetail',description:'Audited KYC review detail for authorized membership/compliance staff. This dedicated endpoint may return decrypted application PII and must not be used by ordinary queues/analytics.'})
 detail(@Param('id',new ParseUUIDPipe()) id:string,@Req() req:any){return this.service.adminDetail(id,req.user?.personId,req.requestId);}
 @Get(':id/cross-line-conflicts') @ApiOperation({operationId:'adminFormalMemberCrossLineConflicts',description:'Evaluate spouse, identity, representative and legal-entity duplicate conflicts from privacy-preserving indexes. Returns codes only; no raw national ID.'})
 conflictsFor(@Param('id',new ParseUUIDPipe()) id:string){return this.conflicts.evaluate(id);}
 @Post(':id/cross-line-review')
 @ApiOperation({operationId:'adminReviewFormalMemberCrossLine',description:'Evaluate and persist the formal membership anti-cross-line result. BLOCKED conflicts must be resolved before any future approval workflow may proceed.'})
 reviewCrossLine(@Param('id',new ParseUUIDPipe()) id:string,@Req() req:any){return this.conflicts.review(id,req.user?.personId,req.requestId);}
 @Post(':id/spouse-verification') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 @ApiOperation({operationId:'adminVerifyFormalMemberSpouse',description:'Confirm spouse data against authorized KYC evidence. Persists only a masked spouse name and keyed identity fingerprint; raw spouse ID is never returned.'})
 verifySpouse(@Param('id',new ParseUUIDPipe()) id:string,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.verifySpouse(id,req.user?.personId,key,req.requestId);}
}
