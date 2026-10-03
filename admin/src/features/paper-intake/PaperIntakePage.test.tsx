import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {command,get} from '../../lib/api';
import {PaperIntakePage} from './PaperIntakePage';

vi.mock('../../lib/api',()=>({get:vi.fn(),command:vi.fn(),qs:(values:Record<string,unknown>)=>{const query=new URLSearchParams(Object.entries(values).filter(([,value])=>value!==undefined&&value!=='' ) as Array<[string,string]>);return query.size?`?${query}`:'';}}));

beforeEach(()=>{vi.mocked(get).mockReset();vi.mocked(command).mockReset();});

it('submits paper package and receipt commands with public paper and order identifiers',async()=>{
 const versionId='11111111-1111-4111-8111-111111111111';
 vi.mocked(get).mockImplementation(async path=>{
  if(path==='/admin/packages')return {data:[{stableCode:'STARTER',packageClass:'QUALIFICATION',versions:[{packageProfileVersionId:versionId,status:'ACTIVE',displayName:'正式資格套組',currency:'TWD',priceAmount:'14400',selectableProductQuantity:1,selectableProducts:[{productRuleProfileId:'rule-1',minQty:0,maxQty:1}]}]}]};
  if(path==='/admin/products')return {data:[{sku:'SKU-1',displayName:'商品一',ruleProfiles:[{productRuleProfileId:'rule-1'}]}]};
  return {data:[]};
 });
 vi.mocked(command).mockResolvedValue({});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 let tree:ReturnType<typeof create>;
 await act(async()=>{tree=create(<QueryClientProvider client={client}><PaperIntakePage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,20));});
 const field=(label:string,type:'input'|'select'='input',occurrence=0)=>tree!.root.findAllByType('label').filter(item=>item.findAllByType('span')[0]?.children.join('')===label)[occurrence].findByType(type);
 act(()=>field('紙本申請編號','input',1).props.onChange({target:{value:'PA-20260926-001'}}));
 act(()=>field('有效資格套組','select').props.onChange({target:{value:versionId}}));
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,5));});
 const quantity=tree!.root.findAllByType('input').find(input=>input.props.type==='number')!;
 act(()=>quantity.props.onChange({target:{value:'1'}}));
 act(()=>field('推薦碼（選填）').props.onChange({target:{value:'a000001'}}));
 await act(async()=>{tree!.root.findAllByType('button').find(button=>button.children.join('')==='建立紙本資格套組訂單')!.props.onClick();await new Promise(resolve=>setTimeout(resolve,10));});
 expect(command).toHaveBeenCalledWith('/admin/paper-applications/qualification-orders',{paperApplicationNo:'PA-20260926-001',packageVersionId:versionId,sponsorCode:'A000001',selections:[{productRuleProfileId:'rule-1',quantity:1}]});
 act(()=>field('訂單編號').props.onChange({target:{value:'000123'}}));
 act(()=>field('收據參考編號').props.onChange({target:{value:'RECEIPT-1'}}));
 act(()=>field('收款金額').props.onChange({target:{value:'14400'}}));
 const received=field('實際收件時間');
 act(()=>received.props.onChange({target:{value:'2026-09-26T16:00'}}));
 await act(async()=>{tree!.root.findAllByType('button').find(button=>button.children.join('')==='登錄收據')!.props.onClick();await new Promise(resolve=>setTimeout(resolve,10));});
 expect(command).toHaveBeenCalledWith('/admin/paper-receipts',expect.objectContaining({orderNo:'000123',receiptReference:'RECEIPT-1',amount:'14400',currency:'TWD'}));
 act(()=>tree!.unmount());
});
