import {act,create} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {it,expect,vi} from 'vitest';
import {ProspectPanel} from './ProspectPanel';
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:'SUPER_ADMIN'}})}));
const report={asOf:'2026-10-23T00:00:00Z',since:'2026-09-23T00:00:00Z',days:30,prospects:10,converted:2,conversionRate:.2,anonymous:4,matured30:{prospects:4,converted:1,conversionRate:.25},sources:[],cohorts:[],current:{anonymous:4,identified:4}};
it('switches acquisition windows without dividing current P and N stocks',()=>{let tree:any;act(()=>{tree=create(<MemoryRouter><ProspectPanel windows={{30:report,7:{...report,days:7,prospects:2,converted:0,conversionRate:0}}}/></MemoryRouter>)});expect(JSON.stringify(tree.toJSON())).toContain('20.0%');act(()=>tree.root.findAllByType('button')[0].props.onClick());expect(JSON.stringify(tree.toJSON())).toContain('0.0%');expect(JSON.stringify(tree.toJSON())).toContain('不能用目前 N 人數除以目前 P 人數');act(()=>tree.unmount());});
it('explicitly explains absent new-policy snapshots and missing formal evidence',()=>{let tree:any;act(()=>{tree=create(<MemoryRouter><ProspectPanel missing={2}/></MemoryRouter>)});expect(JSON.stringify(tree.toJSON())).toContain('舊版資料不會推測補算');expect(tree.root.findAllByProps({role:'alert'})).toHaveLength(1);act(()=>tree.unmount());});
