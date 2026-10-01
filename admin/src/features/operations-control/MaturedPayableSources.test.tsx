import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {expect,it,vi} from 'vitest';
import {MaturedPayableSources} from './MaturedPayableSources';
import * as api from '../../lib/api';
vi.mock('../../lib/api',async()=>({...await vi.importActual('../../lib/api'),get:vi.fn()}));
it('reads an explicit threshold and preserves exact amounts and paging horizon',async()=>{
 vi.stubGlobal('window',{location:{search:'?scope=MATURED_AWARD&thresholdHours=48'}});
 vi.mocked(api.get).mockResolvedValue({data:{items:[{reference:'MATURED-AWARD-'+'a'.repeat(40),sourceType:'BONUS_AWARD',qualificationNo:'100',amount:'10000000000000.0001',maturesAt:'2026-09-01T00:00:00Z',recordedAt:'2026-09-01T00:00:00Z',ruleVersionCode:'R1.0B'}],nextCursor:'MATURED-AWARD-'+'b'.repeat(40),asOf:'2026-10-01T00:00:00Z',cutoff:'2026-09-29T00:00:00Z'}} as any);
 let tree:any;try{await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MaturedPayableSources/></QueryClientProvider>);await new Promise(r=>setTimeout(r,80));});expect(api.get).toHaveBeenCalledWith('/admin/operations/control/matured-payable-sources?thresholdHours=48&take=25');expect(JSON.stringify(tree.toJSON())).toContain('10,000,000,000,000.0001');expect(tree.root.findByProps({href:'/payouts'})).toBeTruthy();await act(async()=>tree.root.findAllByType('button').find((b:any)=>b.children.includes('未建應付來源下一頁')).props.onClick());expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('asOf=2026-10-01T00%3A00%3A00Z'));}finally{if(tree)act(()=>tree.unmount());vi.unstubAllGlobals();}
});
