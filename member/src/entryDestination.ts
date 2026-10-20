/** Preserve only the public website destinations after authentication. */
export function memberEntryDestination(location:{pathname:string;search:string}){
 if(location.pathname==='/explore'||location.pathname==='/business'||location.pathname==='/content'||/^\/content\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(location.pathname)||location.pathname==='/sharing')return location.pathname;
 if(location.pathname==='/shop'){
  const sku=new URLSearchParams(location.search).get('sku');
  return sku&&/^TIP-\d{3}$/.test(sku)?`/shop?sku=${sku}`:'/shop';
 }
 if(['/orders','/me','/learning','/membership/upgrade'].includes(location.pathname))return location.pathname;
 if(location.pathname==='/events'){
  const event=new URLSearchParams(location.search).get('event');
  return event&&/^[A-Z][A-Z0-9_-]{2,39}$/.test(event)?`/events?event=${encodeURIComponent(event)}`:'/events';
 }
 return '/';
}

/** Only exact application routes may come back from referral landing. */
export function shareDestination(value:unknown){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//'))return '/';
 const url=new URL(value,'https://member.ucell.life');
 const safe=memberEntryDestination(url);
 return safe===value?safe:'/';
}
export function shareRegistrationDestination(value:unknown){const destination=shareDestination(value);return destination+(destination.includes('?')?'&':'?')+'mode=register';}
