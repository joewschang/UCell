/** Taipei wall-clock input; preserves server milliseconds when its visible seconds have not changed. */
export function taipeiPaymentInput(iso:string){return new Date(Date.parse(iso)+8*3600000).toISOString().slice(0,19);}
export function paymentInputIso(value:string,original?:string){if(original&&taipeiPaymentInput(original)===value)return new Date(original).toISOString();if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value))return '';const time=Date.parse(value+(value.length===16?':00':'')+'+08:00');return Number.isFinite(time)?new Date(time).toISOString():'';}
