import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { MemberAuthenticationGuard } from '../auth/member-authentication.guard';
import { RetailReferrerAttributionService } from '../order/retail-referrer-attribution.service';

const BALL_NO=/^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6,}|\d{6,})$/;
export class RetailReferrerCandidateDto {
 @ApiProperty({description:'Untrusted public Ball number. This read validates only; it never creates a retail attribution or Sponsor relationship.'})
 @IsString() @Matches(BALL_NO) code!:string;
}

@ApiTags('Member - Retail referral') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard)
@Controller('member/retail-referrer')
export class MemberRetailReferrerController {
 constructor(private readonly retail:RetailReferrerAttributionService) {}
 @Get()
 @ApiOperation({operationId:'memberRetailReferrer',description:'Returns the authenticated WEB_MEMBER current locked retail referrer without holder PII. A null result means checkout may remain unattributed or validate a candidate.'})
 async current(@Req() req:any){const row=await this.retail.current(req.user.personId);return row?{ballNo:row.referrerBallNoSnapshot,effectiveFrom:row.effectiveFrom.toISOString(),locked:true}:null;}
 @Post('candidate')
 @ApiOperation({operationId:'memberValidateRetailReferrerCandidate',description:'Validates a retail Ball candidate without creating permanent attribution, SponsorRelationship, Binary edge, Qualification, or monetary effect.'})
 candidate(@Body() body:RetailReferrerCandidateDto){return this.retail.candidate(body.code);}
}
