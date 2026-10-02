import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {expect,it,vi} from 'vitest';
import {CompensationPeriodSources} from './CompensationPeriodSources';
import * as api from '../../lib/api';
vi.mock('../../lib/api',async()=>({...await vi.importActual('../../lib/api'),get:vi.fn()}));
it('keeps shared whole-line payment separate from source award and provides exact domain links',async()=>{
 const asOf='2026-10-01T00:00:00.000Z',reference='PERIOD-SOURCE-'+'a'.repeat(40),pay='/payouts?reference=PAYOUT-'+'b'.repeat(40),selection={periodStart:'2026-09-10T00:00:00Z',periodEnd:'2026-09-25T00:00:00Z',ruleVersionCode:'R1.0B'};
 vi.mocked(api.get).mockResolvedValue({data:{items:[{reference,sourceType:'BONUS_AWARD',awardType:'REFERRAL',qualificationNo:'700001',theory:'100.0000',originalAward:'100.0000',mature:true,company:false,ownershipLink:'/operations-control?company=COMPANY_BONUS',replay:{count:1,signedAdjustment:'-20.0000'},payable:{reference:'PAYABLE-safe',gross:'100.0000',status:'PAID',link:'/operations-control?scope=PAYABLE'},recoveries:[{reference:'RECOVERY-safe',required:'20.0000',applied:'20.0000',outstanding:'0.0000',link:'/operations-control?scope=RECOVERY'}],payment:{reference:'PAYOUT-safe',status:'PAID',lineReference:'LINE-safe',gross:'150.0000',recoveryOffset:'20.0000',net:'130.0000',bankConfirmed:'130.0000',confirmationCount:2,sharedSources:2,amountScope:'WHOLE_PAYOUT_LINE',link:pay}}],asOf,dataThrough:asOf,nextCursor:reference,periodSourceCount:2}} as any);
 let tree:any;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><CompensationPeriodSources selection={selection}/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,80));});
 const text=JSON.stringify(tree.toJSON());for(const value of ['不能直接當成本來源或本期的付款分攤','100.0000','150.0000','-20.0000','130.0000'])expect(text).toContain(value);expect(tree.root.findByProps({href:pay})).toBeTruthy();
 await act(async()=>tree.root.findAllByType('button').find((row:any)=>row.children.includes('來源下一頁')).props.onClick());expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('cursor='+reference+'&asOf='+encodeURIComponent(asOf)));await act(async()=>tree.unmount());
});
