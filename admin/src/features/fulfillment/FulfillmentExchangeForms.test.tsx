import React from 'react';
import {MemoryRouter} from 'react-router-dom';
import {act,create,type ReactTestInstance} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import {FulfillmentExchangeHistory,ShipmentAfterSalesActions,type ExchangeShipment,type FulfillmentExchange} from './FulfillmentExchangeForms';

const shipment:ExchangeShipment={shipmentReference:'a'.repeat(64),status:'DELIVERED',serials:[
 {serialNo:'A0010001',returned:false},{serialNo:'A0010002',returned:true},{serialNo:'A0010003',returned:false,exchangePending:true},
]};
const exchange:FulfillmentExchange={exchangeReference:'b'.repeat(64),exchangeNo:'X123-001',status:'REQUESTED',reason:'外箱破損',
 createdAt:'2026-11-26T01:00:00Z',receivedAt:null,replacementFulfillmentKey:null,
 items:[{serialNo:'A0010001',sku:'TIP-363',receivedAt:null},{serialNo:'A0010004',sku:'TIP-363',receivedAt:null}],
};
const event={preventDefault(){}};
const button=(root:ReactTestInstance,label:string)=>root.findAllByType('button').find(node=>node.children.join('')===label)!;
function actions(props:Partial<React.ComponentProps<typeof ShipmentAfterSalesActions>>={}){
 return <MemoryRouter><ShipmentAfterSalesActions shipment={shipment} orderNo="123" disabled={false} submit={vi.fn()} {...props}/></MemoryRouter>;
}

it('offers exchange only for dispatched shipments and links financial returns to the precise source order',()=>{
 let view:ReturnType<typeof create>;
 act(()=>{view=create(actions({shipment:{...shipment,status:'LABEL_CREATED'}}));});
 expect(view!.root.findAllByType('button')).toHaveLength(0);
 act(()=>view!.update(actions()));
 act(()=>button(view!.root,'退換貨').props.onClick());
 expect(view!.root.findByType('a').props.href).toBe('/returns?orderNo=123');
 expect(JSON.stringify(view!.toJSON())).toContain('不自動計算或收付差額');
 const checkboxes=view!.root.findAllByType('input');
 expect(checkboxes[0].props.disabled).toBe(false);
 expect(checkboxes[1].props.disabled).toBe(true);expect(checkboxes[2].props.disabled).toBe(true);
 act(()=>view!.unmount());
});

it('validates chosen units and reason, retains the same retry identity after failure, and clears only on success',async()=>{
 const submit=vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);let view:ReturnType<typeof create>;
 act(()=>{view=create(actions({submit}));});act(()=>button(view!.root,'退換貨').props.onClick());
 await act(async()=>view!.root.findByType('form').props.onSubmit(event));
 expect(submit).not.toHaveBeenCalled();
 act(()=>{view!.root.findAllByType('input')[0].props.onChange({target:{checked:true}});view!.root.findByType('textarea').props.onChange({target:{value:'   '}});});
 await act(async()=>view!.root.findByType('form').props.onSubmit(event));
 expect(submit).not.toHaveBeenCalled();
 act(()=>view!.root.findByType('textarea').props.onChange({target:{value:'  封膜破損  '}}));
 await act(async()=>view!.root.findByType('form').props.onSubmit(event));
 expect(submit).toHaveBeenCalledWith({shipmentReference:shipment.shipmentReference,serialNos:['A0010001'],reason:'封膜破損',requestKey:expect.stringMatching(/^[a-f0-9-]{36}$/)});
 expect(view!.root.findByType('textarea').props.value).toBe('  封膜破損  ');
 await act(async()=>view!.root.findByType('form').props.onSubmit(event));
 expect(submit.mock.calls[1]).toEqual(submit.mock.calls[0]);
 expect(view!.root.findAllByType('form')).toHaveLength(0);
 act(()=>button(view!.root,'退換貨').props.onClick());
 expect(view!.root.findByType('textarea').props.value).toBe('');
 expect(view!.root.findAllByType('input')[0].props.checked).toBe(false);
 act(()=>view!.unmount());
});

it('blocks selected units that became unavailable after refresh and prevents stale in-flight submissions',async()=>{
 const submit=vi.fn().mockResolvedValue(true);let view:ReturnType<typeof create>;
 act(()=>{view=create(actions({submit}));});act(()=>button(view!.root,'退換貨').props.onClick());
 act(()=>{view!.root.findAllByType('input')[0].props.onChange({target:{checked:true}});view!.root.findByType('textarea').props.onChange({target:{value:'瑕疵'}});});
 act(()=>view!.update(actions({submit,shipment:{...shipment,serials:shipment.serials.map(serial=>({...serial,exchangePending:true}))}})));
 expect(button(view!.root,'建立同品換貨申請').props.disabled).toBe(true);
 await act(async()=>view!.root.findByType('form').props.onSubmit(event));expect(submit).not.toHaveBeenCalled();
 act(()=>view!.update(actions({submit,disabled:true})));
 await act(async()=>view!.root.findByType('form').props.onSubmit(event));expect(submit).not.toHaveBeenCalled();
 act(()=>view!.unmount());
});

it('allows only one pending request even when a submit event is repeated before render',async()=>{
 let resolve:(value:boolean)=>void=()=>{};const submit=vi.fn(()=>new Promise<boolean>(done=>{resolve=done;}));let view:ReturnType<typeof create>;
 act(()=>{view=create(actions({submit}));});act(()=>button(view!.root,'退換貨').props.onClick());
 act(()=>{view!.root.findAllByType('input')[0].props.onChange({target:{checked:true}});view!.root.findByType('textarea').props.onChange({target:{value:'瑕疵'}});});
 let first:Promise<void>,second:Promise<void>;
 act(()=>{const handler=view!.root.findByType('form').props.onSubmit;first=handler(event);second=handler(event);});
 expect(submit).toHaveBeenCalledTimes(1);
 await act(async()=>{resolve(true);await Promise.all([first!,second!]);});
 act(()=>view!.unmount());
});

it('receives only explicitly checked goods, blocks early replacement, and allows cancellation only before receipt',async()=>{
 const run=vi.fn().mockResolvedValue(true);let view:ReturnType<typeof create>;
 act(()=>{view=create(<FulfillmentExchangeHistory exchanges={[exchange]} canWrite disabled={false} run={run}/>);});
 expect(button(view!.root,'建立同品補寄出貨單')).toBeUndefined();
 expect(button(view!.root,'取消換貨申請')).toBeDefined();
 act(()=>view!.root.findAllByType('input')[0].props.onChange({target:{checked:true}}));
 await act(async()=>view!.root.findByType('form').props.onSubmit(event));
 expect(run).toHaveBeenCalledWith(exchange.exchangeReference,'receive',{serialNos:['A0010001']});
 const partial={...exchange,items:exchange.items.map((item,index)=>({...item,receivedAt:index===0?'2026-11-26T02:00:00Z':null}))};
 act(()=>view!.update(<FulfillmentExchangeHistory exchanges={[partial]} canWrite disabled={false} run={run}/>));
 expect(button(view!.root,'取消換貨申請')).toBeUndefined();
 expect(button(view!.root,'建立同品補寄出貨單')).toBeUndefined();
 expect(view!.root.findAllByType('input')).toHaveLength(1);
 const received={...exchange,status:'RECEIVED' as const,items:exchange.items.map(item=>({...item,receivedAt:'2026-11-26T02:00:00Z'}))};
 act(()=>view!.update(<FulfillmentExchangeHistory exchanges={[received]} canWrite disabled={false} run={run}/>));
 await act(async()=>button(view!.root,'建立同品補寄出貨單').props.onClick());
 expect(run).toHaveBeenLastCalledWith(exchange.exchangeReference,'replacement',{});
 act(()=>view!.unmount());
});

it('keeps audit history read-only and distinguishes a prepared replacement from a dispatched one',()=>{
 const run=vi.fn(),replacement={...exchange,exchangeReference:'c'.repeat(64),status:'REPLACEMENT_CREATED' as const,replacementFulfillmentKey:'F123-X01',replacementStatus:'READY'};let view:ReturnType<typeof create>;
 act(()=>{view=create(<FulfillmentExchangeHistory exchanges={[exchange,replacement]} canWrite={false} disabled={false} run={run}/>);});
 expect(view!.root.findAllByType('form')).toHaveLength(0);expect(view!.root.findAllByType('button')).toHaveLength(0);
 expect(view!.root.findByType('a').props.href).toBe('#fulfillment-F123-X01');
 expect(JSON.stringify(view!.toJSON())).toContain('建立補寄單不代表已寄出');
 act(()=>view!.update(<FulfillmentExchangeHistory exchanges={[{...replacement,replacementStatus:'SHIPPED'}]} canWrite={false} disabled={false} run={run}/>));
 expect(JSON.stringify(view!.toJSON())).toContain('已出貨');
 expect(JSON.stringify(view!.toJSON())).not.toContain('建立補寄單不代表已寄出');
 expect(run).not.toHaveBeenCalled();act(()=>view!.unmount());
});
