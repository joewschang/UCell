export function linkedErpHealth(search:string){
 const params=new URLSearchParams(search),stream=params.get('stream'),raw=params.get('thresholdHours');
 const hours=raw&&/^\d+$/.test(raw)?Number(raw):undefined;
 return {stream:stream&&['SALES','RETURN','COMPENSATION','FULFILLMENT'].includes(stream)?stream:'SALES',threshold:hours!==undefined&&Number.isInteger(hours)&&hours>=1&&hours<=8760?hours:undefined};
}
