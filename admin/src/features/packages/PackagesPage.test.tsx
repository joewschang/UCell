import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {command,get,putCommand} from '../../lib/api';
import {PackagesPage} from './PackagesPage';

const auth=vi.hoisted(()=>({role:'COMPLIANCE_AUDIT'}));
vi.mock('../../lib/api',()=>({get:vi.fn(),command:vi.fn(),putCommand:vi.fn()}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:auth.role}})}));
vi.mock('../../components/ConfirmAction',()=>({ConfirmAction:({children,onConfirm,disabled}:any)=><button disabled={disabled} onClick={()=>onConfirm('APPROVAL-001')}>{children}</button>}));
beforeEach(()=>{auth.role='COMPLIANCE_AUDIT';vi.mocked(get).mockReset();vi.mocked(command).mockReset();vi.mocked(putCommand).mockReset();});

it('renders Core package versions and evidence without calculating monetary values',async()=>{
 vi.mocked(get).mockResolvedValue({data:[{packageProfileId:'profile-1',stableCode:'QUALIFICATION_STARTER',packageClass:'QUALIFICATION',status:'ACTIVE',versions:[{packageProfileVersionId:'version-1',version:2,displayName:'正式會員套組',currency:'TWD',priceAmount:'4800.00',selectableProductQuantity:2,selectionMode:'EXACT_QUANTITY',membershipEffect:'FORMAL_MEMBER',qualificationEffect:'CREATE_QUALIFICATION',targetQualificationRequired:false,status:'ACTIVE',effectiveFrom:'2026-09-17T00:00:00.000Z',effectiveTo:null,salesFrom:'2026-09-17T00:00:00.000Z',salesTo:null,approvalReference:'APPROVAL-001',configHash:'a'.repeat(64),selectableProducts:[{productRuleProfileId:'rule-1',minQty:1,maxQty:2,selectionIncrement:1,sortOrder:1,status:'ACTIVE'}]}]}]});
 let tree:ReturnType<typeof create>;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PackagesPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,20));});
 const rendered=JSON.stringify(tree!.toJSON());expect(get).toHaveBeenCalledWith('/admin/packages');expect(rendered).toContain('正式會員套組');expect(rendered).toContain('4800.00');expect(rendered).toContain('EXACT_QUANTITY');expect(rendered).toContain('APPROVAL-001');expect(rendered).toContain('Core authoritative');expect(rendered).not.toContain('PV =');act(()=>tree!.unmount());
});

it('submits normalized profile creation through the idempotent command client for package managers',async()=>{
 auth.role='PACKAGE_CONFIG_MANAGE';vi.mocked(get).mockResolvedValue({data:[]});vi.mocked(command).mockResolvedValue({});
 let tree:ReturnType<typeof create>;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PackagesPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,20));});
 const input=tree!.root.findAllByType('input')[0];act(()=>input.props.onChange({target:{value:'starter_ball'}}));
 const createButton=tree!.root.findAllByType('button').find(button=>button.children.join('')==='建立套組主檔')!;
 await act(async()=>{createButton.props.onClick();await new Promise(resolve=>setTimeout(resolve,10));});
 expect(command).toHaveBeenCalledWith('/admin/packages',{stableCode:'STARTER_BALL',packageClass:'QUALIFICATION'});act(()=>tree!.unmount());
});

it('submits only explicit Core version configuration and does not derive PV or BV',async()=>{
 auth.role='PACKAGE_CONFIG_MANAGE';vi.mocked(get).mockResolvedValue({data:[{packageProfileId:'11111111-1111-4111-8111-111111111111',stableCode:'STARTER_BALL',packageClass:'QUALIFICATION',status:'ACTIVE',versions:[]}]});vi.mocked(command).mockResolvedValue({});
 let tree:ReturnType<typeof create>;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PackagesPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,20));});
 const field=(label:string,type:'input'|'select'='input')=>{const row=tree!.root.findAllByType('label').find(item=>item.findAllByType('span')[0]?.children.join('')===label)!;return row.findByType(type);};
 act(()=>field('套組主檔','select').props.onChange({target:{value:'11111111-1111-4111-8111-111111111111'}}));
 act(()=>field('顯示名稱').props.onChange({target:{value:'正式會員套組'}}));act(()=>field('正式價格').props.onChange({target:{value:'4800'}}));act(()=>field('Membership Effect').props.onChange({target:{value:'FORMAL_MEMBER'}}));act(()=>field('Qualification Effect').props.onChange({target:{value:'CREATE_QUALIFICATION'}}));act(()=>field('Recognition Config Reference').props.onChange({target:{value:'R1_QUALIFICATION'}}));
 await act(async()=>{tree!.root.findAllByType('button').find(button=>button.children.join('')==='新增版本草稿')!.props.onClick();await new Promise(resolve=>setTimeout(resolve,10));});
 expect(command).toHaveBeenCalledWith('/admin/packages/11111111-1111-4111-8111-111111111111/versions',{displayName:'正式會員套組',currency:'TWD',priceAmount:'4800',selectableProductQuantity:1,membershipEffect:'FORMAL_MEMBER',qualificationEffect:'CREATE_QUALIFICATION',targetQualificationRequired:false,recognitionConfigRef:'R1_QUALIFICATION'});expect(JSON.stringify(vi.mocked(command).mock.calls[0][1])).not.toMatch(/pv|bv/i);act(()=>tree!.unmount());
});

it('replaces a DRAFT product pool through the idempotent PUT command with explicit limits',async()=>{
 auth.role='PACKAGE_CONFIG_MANAGE';const versionId='11111111-1111-4111-8111-111111111111',ruleId='22222222-2222-4222-8222-222222222222';vi.mocked(get).mockImplementation(async path=>path==='/admin/products'?{data:[{productId:'product-1',sku:'SKU-1',displayName:'商品一',currentPrice:'100',currency:'TWD',isActive:true,ruleProfiles:[{productRuleProfileId:ruleId,gpvRate:'0',pvRate:'0',ruleVersionCode:'RULE-1'}]}]}:{data:[{packageProfileId:'profile-1',stableCode:'STARTER_BALL',packageClass:'QUALIFICATION',status:'ACTIVE',versions:[{packageProfileVersionId:versionId,version:1,displayName:'正式會員套組',currency:'TWD',priceAmount:'4800',selectableProductQuantity:2,selectionMode:'EXACT_QUANTITY',membershipEffect:'FORMAL_MEMBER',qualificationEffect:'CREATE_QUALIFICATION',targetQualificationRequired:false,status:'DRAFT',effectiveFrom:null,effectiveTo:null,salesFrom:null,salesTo:null,approvalReference:null,configHash:'a'.repeat(64),selectableProducts:[]}]}]} as any);vi.mocked(putCommand).mockResolvedValue({});
 let tree:ReturnType<typeof create>;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PackagesPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,20));});
 const select=(label:string)=>tree!.root.findAllByType('label').find(item=>item.findAllByType('span')[0]?.children.join('')===label)!.findByType('select');
 act(()=>select('DRAFT 套組版本').props.onChange({target:{value:versionId}}));act(()=>select('加入 Product Rule Profile').props.onChange({target:{value:ruleId}}));
 await act(async()=>{tree!.root.findAllByType('button').find(button=>button.children.join('')==='儲存完整商品池')!.props.onClick();await new Promise(resolve=>setTimeout(resolve,10));});
 expect(putCommand).toHaveBeenCalledWith(`/admin/packages/versions/${versionId}/selectable-products`,{products:[{productRuleProfileId:ruleId,minQty:0,maxQty:1,selectionIncrement:1,sortOrder:0}]});act(()=>tree!.unmount());
});

it('allows the approval role to submit a recorded reference without exposing creator controls',async()=>{
 auth.role='PACKAGE_CONFIG_APPROVE';const versionId='11111111-1111-4111-8111-111111111111';vi.mocked(get).mockResolvedValue({data:[{packageProfileId:'profile-1',stableCode:'STARTER_BALL',packageClass:'QUALIFICATION',status:'ACTIVE',versions:[{packageProfileVersionId:versionId,version:1,displayName:'正式會員套組',currency:'TWD',priceAmount:'4800',selectableProductQuantity:2,selectionMode:'EXACT_QUANTITY',membershipEffect:'FORMAL_MEMBER',qualificationEffect:'CREATE_QUALIFICATION',targetQualificationRequired:false,status:'DRAFT',effectiveFrom:null,effectiveTo:null,salesFrom:null,salesTo:null,approvalReference:null,configHash:'a'.repeat(64),selectableProducts:[{productRuleProfileId:'rule-1',minQty:0,maxQty:2,selectionIncrement:1,sortOrder:0,status:'ACTIVE'}]}]}]});vi.mocked(command).mockResolvedValue({});
 let tree:ReturnType<typeof create>;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PackagesPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,20));});
 expect(tree!.root.findAllByType('button').some(button=>button.children.join('')==='建立套組主檔')).toBe(false);
 await act(async()=>{tree!.root.findAllByType('button').find(button=>button.children.join('')==='核准版本')!.props.onClick();await new Promise(resolve=>setTimeout(resolve,10));});
 expect(command).toHaveBeenCalledWith(`/admin/packages/versions/${versionId}/approve`,{approvalReference:'APPROVAL-001'});act(()=>tree!.unmount());
});

it('requires an explicit timezone and sends no inferred package schedule values',async()=>{
 auth.role='PACKAGE_CONFIG_APPROVE';const versionId='11111111-1111-4111-8111-111111111111';vi.mocked(get).mockResolvedValue({data:[{packageProfileId:'profile-1',stableCode:'STARTER_BALL',packageClass:'QUALIFICATION',status:'ACTIVE',versions:[{packageProfileVersionId:versionId,version:1,displayName:'正式會員套組',currency:'TWD',priceAmount:'4800',selectableProductQuantity:2,selectionMode:'EXACT_QUANTITY',membershipEffect:'FORMAL_MEMBER',qualificationEffect:'CREATE_QUALIFICATION',targetQualificationRequired:false,status:'APPROVED',effectiveFrom:null,effectiveTo:null,salesFrom:null,salesTo:null,approvalReference:'APPROVAL-001',configHash:'a'.repeat(64),selectableProducts:[]}]}]});vi.mocked(command).mockResolvedValue({});
 let tree:ReturnType<typeof create>;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PackagesPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,20));});
 const field=(label:string,type:'input'|'select')=>tree!.root.findAllByType('label').find(item=>item.findAllByType('span')[0]?.children.join('')===label)!.findByType(type);
 const submit=tree!.root.findAllByType('button').find(button=>button.children.join('')==='儲存明確排程')!;expect(submit.props.disabled).toBe(true);expect(field('生效時間（含時區）','input').props.value).toBe('');
 act(()=>field('APPROVED 套組版本','select').props.onChange({target:{value:versionId}}));act(()=>field('生效時間（含時區）','input').props.onChange({target:{value:'2026-10-01T00:00:00+08:00'}}));
 await act(async()=>{submit.props.onClick();await new Promise(resolve=>setTimeout(resolve,10));});expect(command).toHaveBeenCalledWith(`/admin/packages/versions/${versionId}/schedule`,{effectiveFrom:'2026-10-01T00:00:00+08:00'});act(()=>tree!.unmount());
});

it('offers activation only for scheduled versions and keeps retirement explicit',async()=>{
 auth.role='PACKAGE_CONFIG_APPROVE';const versionId='11111111-1111-4111-8111-111111111111';vi.mocked(get).mockResolvedValue({data:[{packageProfileId:'profile-1',stableCode:'STARTER_BALL',packageClass:'QUALIFICATION',status:'ACTIVE',versions:[{packageProfileVersionId:versionId,version:1,displayName:'正式會員套組',currency:'TWD',priceAmount:'4800',selectableProductQuantity:2,selectionMode:'EXACT_QUANTITY',membershipEffect:'FORMAL_MEMBER',qualificationEffect:'CREATE_QUALIFICATION',targetQualificationRequired:false,status:'SCHEDULED',effectiveFrom:'2026-09-17T00:00:00.000Z',effectiveTo:null,salesFrom:null,salesTo:null,approvalReference:'APPROVAL-001',configHash:'a'.repeat(64),selectableProducts:[]}]}]});vi.mocked(command).mockResolvedValue({});
 let tree:ReturnType<typeof create>;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PackagesPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,20));});
 await act(async()=>{tree!.root.findAllByType('button').find(button=>button.children.join('')==='啟用已到期排程')!.props.onClick();await new Promise(resolve=>setTimeout(resolve,10));});await act(async()=>{tree!.root.findAllByType('button').find(button=>button.children.join('')==='退役版本')!.props.onClick();await new Promise(resolve=>setTimeout(resolve,10));});
 expect(command).toHaveBeenCalledWith(`/admin/packages/versions/${versionId}/activate`);expect(command).toHaveBeenCalledWith(`/admin/packages/versions/${versionId}/retire`);act(()=>tree!.unmount());
});
