import {expect,it} from 'vitest';
import {linkedErpHealth} from './linked-erp-health';
it('retains a linked fulfillment stream and threshold',()=>expect(linkedErpHealth('?stream=FULFILLMENT&thresholdHours=48')).toEqual({stream:'FULFILLMENT',threshold:48}));
it.each(['0','8761','24.5','-1','NaN','1e2',''])('does not invent an ERP threshold from %s',value=>expect(linkedErpHealth('?stream=INVALID&thresholdHours='+value)).toEqual({stream:'SALES',threshold:undefined}));
