import React from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import {PayoutResultForm} from './PayoutResultForm';
vi.mock('../../components/ConfirmAction',()=>({ConfirmAction:({children,onConfirm,disabled}:any)=><button disabled={disabled} onClick={onConfirm}>{children}</button>}));
const lines=[{payoutLineId:'internal-line',netAmount:'100',recipient:{ballNo:'BALL-100',currentHolder:{memberNo:'M100'}}}];
it('requires explicit actual evidence, preserves failed input and sends cumulative partial payment',async()=>{
 const submit=vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);let view:ReturnType<typeof create>;act(()=>{view=create(<PayoutResultForm lines={lines} disabled={false} submit={submit}/>);});
 expect(view!.root.findByType('button').props.disabled).toBe(true);
 act(()=>{view!.root.findAllByType('select')[0].props.onChange({target:{value:'internal-line'}});view!.root.findAllByType('select')[1].props.onChange({target:{value:'PAID'}});});
 act(()=>{const inputs=view!.root.findAllByType('input');inputs[0].props.onChange({target:{value:'40'}});inputs[1].props.onChange({target:{value:'BANK-PARTIAL'}});inputs[2].props.onChange({target:{value:'2026-09-29T15:30:00+08:00'}});});
 await act(async()=>view!.root.findByType('button').props.onClick());expect(view!.root.findAllByType('input')[0].props.value).toBe('40');
 await act(async()=>view!.root.findByType('button').props.onClick());expect(submit.mock.calls[1]).toEqual(submit.mock.calls[0]);expect(submit).toHaveBeenCalledWith({results:[{payoutLineId:'internal-line',status:'PAID',paidAmount:'40',paymentReference:'BANK-PARTIAL',occurredAt:'2026-09-29T07:30:00.000Z'}]});
 act(()=>view!.unmount());
});
it('sends zero paid amount for an explicitly documented failure',async()=>{
 const submit=vi.fn().mockResolvedValue(true);let view:ReturnType<typeof create>;act(()=>{view=create(<PayoutResultForm lines={lines} disabled={false} submit={submit}/>);});
 act(()=>{view!.root.findAllByType('select')[0].props.onChange({target:{value:'internal-line'}});view!.root.findAllByType('select')[1].props.onChange({target:{value:'FAILED'}});});
 act(()=>{const inputs=view!.root.findAllByType('input');inputs[0].props.onChange({target:{value:'BANK-FAIL'}});inputs[1].props.onChange({target:{value:'BANK_REJECTED'}});inputs[2].props.onChange({target:{value:'2026-09-29T15:30:00+08:00'}});});
 await act(async()=>view!.root.findByType('button').props.onClick());expect(submit.mock.calls[0][0].results[0]).toMatchObject({status:'FAILED',paidAmount:'0',reasonCode:'BANK_REJECTED'});act(()=>view!.unmount());
});
