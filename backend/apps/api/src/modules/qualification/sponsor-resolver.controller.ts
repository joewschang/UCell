import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { SponsorResolver } from './sponsor-resolver.service';
class SponsorCodeQuery { @IsString() @Matches(/^[A-Z][A-Z0-9_-]{1,39}$/) code!:string; }
@ApiTags('Onboarding - Sponsor')
@Controller('onboarding/sponsor')
export class SponsorResolverController {
 constructor(private readonly resolver:SponsorResolver){}
 @Get('candidate') @ApiQuery({name:'code',description:'Candidate Sponsor Ball number or governed Company Alias; memberNo and UUID are rejected.'})
 @ApiOperation({operationId:'onboardingResolveSponsorCandidate',description:'Resolves an untrusted Sponsor Code as a candidate only. It does not create a Sponsor relationship; acquisition commit must resolve again and persist authoritative evidence.'})
 @ApiResponse({status:200,description:'Minimal Sponsor Ball evidence without holder PII'})
 candidate(@Query() query:SponsorCodeQuery){return this.resolver.resolve({code:query.code});}
}
