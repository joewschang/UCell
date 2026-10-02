import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {expect,it,vi} from 'vitest';
import {OperationsFinancialHealth} from './OperationsFinancialHealth';
import * as api from '../../lib/api';
vi.mock('../../lib/api',async()=>({...await vi.importActual('../../lib/api'),get:vi.fn()}));
it('labels the bounded whole-batch bank evidence and keeps the saved horizon across healthy rows',async()=>{
 const reference='PAYOUT-'+'a'.repeat(40),asOf='2026-10-01T00:00:00.000Z';
 vi.mocked(api.get).mockResolvedValue({data:{items:[{reference,scope:'PAYOUT',status:'PARTIALLY_PAID',createdAt:asOf,evidence:{bankConfirmed:'40.0000',totalNet:'100.0000',amountScope:'WHOLE_PAYOUT_BATCH'},actionLink:'/payouts?reference='+reference,candidates:[{code:'BANK_RESULT_INCOMPLETE',evidenceHash:'b'.repeat(64)}]}],observed:1,counts:{attention:1,bankFailedLines:0,bankUnreconciledLines:1},recoveryOutstanding:'0.0000',nextCursor:reference,asOf,dataThrough:asOf}} as any);
 let tree:any;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><OperationsFinancialHealth/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,80));});
 const text=JSON.stringify(tree.toJSON());expect(text).toContain('不代表全系統');expect(text).toContain('最高累計確認值');expect(text).toContain('銀行付款尚未完整確認');expect(tree.root.findByProps({href:'/payouts?reference='+reference})).toBeTruthy();
 await act(async()=>tree.root.findAllByType('button').find((row:any)=>row.children.includes('財務證據下一頁')).props.onClick());expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('cursor='+reference+'&asOf='+encodeURIComponent(asOf)));await act(async()=>tree.unmount());
});
