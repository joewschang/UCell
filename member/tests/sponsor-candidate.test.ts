import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {resolveSponsorCandidate} from '../src/memberData';

const envelope=(data:unknown)=>({ok:true,status:200,json:async()=>({data,meta:{api_version:'v1',request_id:'sponsor-candidate-test',timestamp:'2026-09-25T00:00:00.000Z'}})});
afterEach(()=>vi.unstubAllGlobals());
beforeEach(()=>vi.stubGlobal('sessionStorage',{getItem:()=>null}));

it('accepts a neutral Company Alias candidate without bootstrap or holder fields',async()=>{
 const fetch=vi.fn(async()=>envelope({kind:'COMPANY_ALIAS',displayLabel:'UCell 公司推薦',policyVersion:'COMPANY_ALIAS_V1',ruleVersion:'R1.0B',effectiveAt:'2026-01-01T00:00:00.000Z'}));
 vi.stubGlobal('fetch',fetch);
 const candidate=await resolveSponsorCandidate('UCELL_COMPANY',new AbortController().signal);
 expect(candidate).toMatchObject({kind:'COMPANY_ALIAS',displayLabel:'UCell 公司推薦'});
 expect(JSON.stringify(candidate)).not.toMatch(/bootstrap|holder|AX00000|reservoir/i);
 expect(String(fetch.mock.calls[0][0])).toContain('code=UCELL_COMPANY');
});

it('continues to accept an exact Ball candidate',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>envelope({kind:'BALL',sponsorBallNo:'A001286',planLevelCode:'STARTER',ruleVersion:'R1.0B',effectiveAt:'2026-01-01T00:00:00.000Z'})));
 await expect(resolveSponsorCandidate('A001286',new AbortController().signal)).resolves.toMatchObject({kind:'BALL',sponsorBallNo:'A001286'});
});
