import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {expect,it,vi} from 'vitest';
import {OperationsCompanyHealth} from './OperationsCompanyHealth';
import * as api from '../../lib/api';
vi.mock('../../lib/api',async()=>({...await vi.importActual('../../lib/api'),get:vi.fn()}));
it('separates original Company entitlement from signed replay and retains the paging horizon',async()=>{
 const reference='COMPANY-BONUS-'+'a'.repeat(40),asOf='2026-10-01T00:00:00.000Z';
 vi.mocked(api.get).mockResolvedValue({data:{items:[{reference,scope:'COMPANY_BONUS',evidence:{qualificationNo:'700001',awardType:'REFERRAL',historicalCompany:true,occurredAt:asOf,sourceAmount:'100.0000',ruleVersionCode:'R1',destinationReference:'RESERVOIR-DESTINATION-'+'b'.repeat(40),destination:'RESERVOIR_B',periodStart:asOf,periodEnd:asOf,originalEntitlement:'100.0000',originalCredit:'100.0000',originalEffectCount:1,replayAdjustment:'-20.0000',replayEffectCount:1,recordedBalance:'80.0000'},candidates:[]}],observed:1,attention:0,nextCursor:reference,asOf,dataThrough:asOf}} as any);
 let tree:any;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><OperationsCompanyHealth/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,80));});
 const text=JSON.stringify(tree.toJSON());for(const value of ['原始權益','100.0000','-20.0000','80.0000','不代表全部水庫餘額','獎金發生時屬 Company'])expect(text).toContain(value);
 expect(api.get).toHaveBeenCalledWith('/admin/operations/control/company-health?scope=COMPANY_BONUS&take=25');
 await act(async()=>tree.root.findAllByType('button').find((row:any)=>row.children.includes('Company 證據下一頁')).props.onClick());
 expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('cursor='+reference+'&asOf='+encodeURIComponent(asOf)));
 await act(async()=>tree.unmount());
});
