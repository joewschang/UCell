import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {beforeEach,expect,it,vi} from 'vitest';
import {CompensationStageHistory} from './CompensationStageHistory';
import * as api from '../../lib/api';
const auth=vi.hoisted(()=>({user:{role:'COMPLIANCE_AUDIT',personId:'synthetic-actor'} as any}));
vi.mock('../auth/auth',()=>({useAuth:()=>auth}));
vi.mock('../../lib/api',async()=>({...await vi.importActual('../../lib/api'),get:vi.fn(),post:vi.fn()}));
const period={periodStart:'2026-09-01T00:00:00Z',periodEnd:'2026-10-01T00:00:00Z',ruleVersionCode:'R1.0B'};
const row={reference:'PERIOD-STAGE-'+'a'.repeat(40),revision:3,stage:'BLOCKED',previousStage:'PRECHECK',observedAt:'2026-10-02T00:00:00Z',sourceAsOf:'2026-10-01T23:59:00Z',businessEnteredAt:null};
beforeEach(()=>{auth.user={role:'COMPLIANCE_AUDIT',personId:'synthetic-actor'};vi.mocked(api.get).mockReset().mockResolvedValue({data:{items:[row],nextCursor:3,asOf:'2026-10-02T01:00:00Z'}} as any);vi.mocked(api.post).mockReset().mockResolvedValue({data:{}} as any);});
async function mount(){let tree:any;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><CompensationStageHistory period={period}/></QueryClientProvider>);await new Promise(r=>setTimeout(r,80));});return tree;}
it('presents saved observations without claiming stage duration and retains the paging cutoff',async()=>{
 const tree=await mount();try{const text=JSON.stringify(tree.toJSON());expect(text).toContain('有阻擋項目');expect(text).toContain('實際階段進入時間：尚無證據');expect(text).not.toContain('BLOCKED');expect(text).not.toContain('synthetic-actor');expect(tree.root.findAllByType('button').some((b:any)=>b.children.includes('保存目前查核觀察'))).toBe(false);await act(async()=>tree.root.findAllByType('button').find((b:any)=>b.children.includes('歷程下一頁')).props.onClick());expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('cursor=3&asOf=2026-10-02T01%3A00%3A00Z'));expect(api.post).not.toHaveBeenCalled();}finally{act(()=>tree.unmount());}
});
it('saves exactly the selected period for an authenticated finance actor and reports failure without a false success',async()=>{
 auth.user={role:'FINANCE',personId:'synthetic-actor'};vi.mocked(api.post).mockRejectedValueOnce(new Error('保存失敗')).mockResolvedValue({data:{}} as any);const tree=await mount();try{const save=()=>tree.root.findAllByType('button').find((b:any)=>b.children.includes('保存目前查核觀察'));await act(async()=>save().props.onClick());expect(api.post).toHaveBeenCalledWith('/admin/compensation-period-control/stage-history/refresh',period);expect(JSON.stringify(tree.toJSON())).toContain('保存失敗');expect(JSON.stringify(tree.toJSON())).not.toContain('查核觀察已保存');await act(async()=>{save().props.onClick();await new Promise(r=>setTimeout(r,80));});expect(JSON.stringify(tree.toJSON())).toContain('查核觀察已保存');}finally{act(()=>tree.unmount());}
});
it('does not offer saving for a finance role without an actor and retries failed reads to a true empty history',async()=>{
 auth.user={role:'FINANCE'};vi.mocked(api.get).mockRejectedValueOnce(new Error('讀取失敗')).mockResolvedValue({data:{items:[],nextCursor:null,asOf:'2026-10-02T01:00:00Z'}} as any);const tree=await mount();try{expect(JSON.stringify(tree.toJSON())).toContain('讀取失敗');expect(tree.root.findAllByType('button').some((b:any)=>b.children.includes('保存目前查核觀察'))).toBe(false);await act(async()=>{tree.root.findAllByType('button').find((b:any)=>b.children.includes('重新載入')).props.onClick();await new Promise(r=>setTimeout(r,80));});expect(JSON.stringify(tree.toJSON())).toContain('目前沒有符合條件的資料');expect(api.post).not.toHaveBeenCalled();}finally{act(()=>tree.unmount());}
});
