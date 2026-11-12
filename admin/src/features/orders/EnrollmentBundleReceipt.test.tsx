import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {act,create,type ReactTestInstance,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {command,get} from '../../lib/api';
import {OrdersPage} from './OrdersPage';

const auth=vi.hoisted(()=>({role:'FINANCE'}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:auth.role}})}));
vi.mock('../../lib/api',async importOriginal=>({...await importOriginal<typeof import('../../lib/api')>(),get:vi.fn(),command:vi.fn()}));

const first='00000000-0000-4000-8000-000000000001',second='00000000-0000-4000-8000-000000000002';
const paymentTime='2025-01-15T10:30:00';
const dialogReason={value:''};
let view:ReactTestRenderer|undefined;
let client:QueryClient;
let paid=false;
let deadline:string|null=null;
function order(id:string){
  return {orderId:id,purpose:'ENTRY',qualificationId:'ball-'+id,status:paid?'PAID':'CONFIRMED',
    createdAt:'2025-01-01T10:00:00Z',netAmount:id===first?'15000.25':'11000.00'};
}
const bundle=()=>({bundleId:'group-1',total:'26000.25',
  lines:[first,second].map((id,i)=>({orderId:id,orderNo:String(1251+i),position:i+1,status:order(id).status,amount:order(id).netAmount,createdAt:order(id).createdAt,paymentDeadline:deadline})),
  report:{amount:'26000.25',accountLastFive:'02178',paidAt:'2025-01-15T01:02:00Z'},
  receipt:paid?{amount:'26000.25',referenceNo:'Bank-260',receivedAt:'2025-01-15T02:30:00Z'}:null});

beforeEach(()=>{
  auth.role='FINANCE';paid=false;deadline=null;
  client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  vi.mocked(get).mockReset().mockImplementation(async path=>{
    if(path.startsWith('/admin/orders?'))return {data:[order(first),order(second)]} as never;
    if(path==='/admin/products')return {data:[]} as never;
    if(path==='/admin/orders/'+second)return {data:{...order(second),enrollmentBundlePayment:bundle()}} as never;
    throw new Error('Unexpected GET '+path);
  });
  vi.mocked(command).mockReset().mockImplementation(async()=>{paid=true;return {data:{}} as never;});
});
afterEach(()=>{if(view)act(()=>view!.unmount());view=undefined;client.clear();});
async function openSecondOrder(){
  await act(async()=>{
    view=create(<MemoryRouter initialEntries={['/orders?orderId='+second]}><QueryClientProvider client={client}><OrdersPage/></QueryClientProvider></MemoryRouter>,
      {createNodeMock:el=>el.type==='input'?dialogReason:{showModal:vi.fn(),close:vi.fn(),open:false}});
  });
  await vi.waitFor(()=>expect(buttons(view!.root,/^收款$/)).toHaveLength(1));
  act(()=>buttons(view!.root,/^收款$/)[0].props.onClick());
  await vi.waitFor(()=>expect(view!.root.findAllByProps({'aria-label':'整組資格收款'})).toHaveLength(1));
  return view!.root.findByProps({'aria-label':'整組資格收款'});
}
function text(node:ReactTestInstance):string{return node.children.map(child=>typeof child==='string'?child:text(child)).join('');}
function buttons(view:ReactTestInstance,label:RegExp){return view.findAllByType('button').filter(node=>label.test(text(node)));}
function edit(section:ReactTestInstance,label:string,value:string) {
  const field=section.findAllByType('label').find(node=>text(node).includes(label));
  if(!field)throw new Error('Missing field '+label);
  act(()=>field.findByType('input').props.onChange({target:{value}}));
}
async function submit(section:ReactTestInstance){
  act(()=>buttons(section,/確認整組資格收款/)[0].props.onClick());
  dialogReason.value='已核對銀行紀錄';
  await act(async()=>{await section.findByType('form').props.onSubmit({preventDefault(){}});});
}

it('reconciles a bundle from its second order, posts once and reads the receipt back',async()=>{
  const section=await openSecondOrder();
  expect(section.findByType('summary').children.join('')).toContain('逐球');
  const lines=section.findAllByType('li').map(text);
  expect(lines).toHaveLength(2);
  expect(lines[0]).toMatch(/第 1 球.*1251.*15,000\.25/);
  expect(text(section)).toContain('26,000.25');
  expect(lines[1]).toMatch(/第 2 球.*1252.*11,000/);
  expect(text(section)).toContain('02178');
  expect(buttons(view!.root,/確認全額收款/)).toHaveLength(0);
  const submitButton=()=>buttons(section,/確認整組資格收款/)[0];
  expect(submitButton().props.disabled).toBe(true);
  edit(section,'銀行交易序號','  Bank-260  ');
  edit(section,'實際收款時間',paymentTime);
  edit(section,'實收金額','25999.99');
  expect(submitButton().props.disabled).toBe(true);
  expect(text(section)).toContain('最多保留兩位小數');
  edit(section,'實收金額','2.600025e4');
  expect(submitButton().props.disabled).toBe(true);
  edit(section,'實收金額','26000.25');
  edit(section,'實際收款時間','2024-12-30T02:00:00');
  expect(submitButton().props.disabled).toBe(true);
  edit(section,'實際收款時間','2099-03-01T09:05:00');
  expect(submitButton().props.disabled).toBe(true);
  edit(section,'實際收款時間',paymentTime);
  expect(submitButton().props.disabled).toBe(false);
  const before=vi.mocked(get).mock.calls.filter(([path])=>path==='/admin/orders/'+second).length;
  await submit(section);
  expect(command).toHaveBeenCalledTimes(1);
  expect(command).toHaveBeenCalledWith('/admin/orders/'+second+'/bundle-payment-confirmations',
    {amount:'26000.25',paymentMethod:'BANK_TRANSFER',referenceNo:'Bank-260',occurredAt:new Date(paymentTime).toISOString()},expect.any(String));
  await vi.waitFor(()=>expect(text(section)).toContain('整組已收款'));
  expect(text(section)).toContain('Bank-260');
  expect(vi.mocked(get).mock.calls.filter(([path])=>path==='/admin/orders/'+second)).toHaveLength(before+1);
  expect(buttons(section,/確認整組資格收款/)).toHaveLength(0);
});

it('prevents posting expired allocations even for finance operators',async()=>{
  deadline='2025-01-10T09:00:00Z';
  const section=await openSecondOrder();
  expect(text(section)).toContain('付款期限已過');
  expect(buttons(view!.root,/確認全額收款|確認整組資格收款/)).toHaveLength(0);
  expect(command).not.toHaveBeenCalled();
});

it('gives an auditor the allocation and transfer details with no single or combined receipt controls',async()=>{
  auth.role='COMPLIANCE_AUDIT';
  const section=await openSecondOrder();
  expect(section.findAllByType('li').map(text)).toEqual([expect.stringContaining('1251'),expect.stringContaining('1252')]);
  expect(text(section)).toContain('02178');
  expect(section.findAllByType('input')).toHaveLength(0);
  expect(buttons(view!.root,/確認全額收款|確認整組資格收款/)).toHaveLength(0);
  expect(command).not.toHaveBeenCalled();
});
