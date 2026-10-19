/** Preserve only the public website destinations after authentication. */
export function memberEntryDestination(location:{pathname:string;search:string}){
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
