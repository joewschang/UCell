import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {beforeEach,expect,it,vi} from 'vitest';
import {PeoplePage} from './PeoplePage';
import {command,get} from '../../lib/api';

vi.mock('../../lib/api',()=>({get:vi.fn(),command:vi.fn(),qs:(values:Record<string,string|number|undefined>)=>{const query=new URLSearchParams();Object.entries(values).forEach(([key,value])=>{if(value!==undefined)query.set(key,String(value))});return '?'+query.toString()}}));
vi.mock('../qualifications/QualificationDetail',()=>({QualificationDetail:()=>null}));

const person={personId:'person-internal-uuid',memberNo:'2609000001',legalName:'王小明',preferredName:'小明',mobile:'0912345678',email:'member@example.test',status:'ACTIVE'};

beforeEach(()=>{
 vi.mocked(command).mockReset();
 vi.mocked(get).mockReset().mockImplementation(async(path:string)=>{
  if(path.includes('/qualifications'))return {data:[{qualificationId:'qualification-internal-uuid',ballNo:'A000004',planLevelCode:'STALE_PLAN_SHOULD_NOT_RENDER',status:'EFFECTIVE',activeFlag:true,admin360:{organization:{status:'AVAILABLE',treeCode:'TREE-A'},owner:{status:'AVAILABLE',ownerType:'MEMBER',memberNo:'2609000001'},plan:{status:'AVAILABLE',planCode:'STARTER'},globalRank:{status:'AVAILABLE',highestRank:'DIAMOND'}}}],meta:{total:1}} as any;
  return {data:[person]} as any;
 });
});

async function render(){
 let view:ReturnType<typeof create>;
 await act(async()=>{view=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PeoplePage/></QueryClientProvider>)});
 await vi.waitFor(()=>expect(JSON.stringify(view!.toJSON())).toContain('2609000001'));
 return view!;
}

it('uses Member Number and Ball Number in Person 360 without rendering internal identifiers',async()=>{
 const view=await render();
 let output=JSON.stringify(view.toJSON());
 expect(output).toContain('會員編號');
 expect(output).toContain('2609000001');
 expect(output).not.toContain('Person ID');
 expect(output).not.toContain('person-internal-uuid');
 await act(async()=>view.root.findAllByType('button').find(button=>button.children.join('')==='查看會員 360')!.props.onClick());
 await vi.waitFor(()=>expect(JSON.stringify(view.toJSON())).toContain('A000004'));
 output=JSON.stringify(view.toJSON());
 expect(output).toContain('Ball Portfolio');
 expect(output).toContain('A000004');
 expect(output).toContain('TREE-A');
 expect(output).toContain('全球累積階級 DIAMOND');
 expect(output).toContain('會員持有 · 2609000001');
 expect(output).toContain('STARTER');
 expect(output).not.toContain('STALE_PLAN_SHOULD_NOT_RENDER');
 expect(output).not.toContain('qualification-internal-uuid');
 act(()=>view.unmount());
});
