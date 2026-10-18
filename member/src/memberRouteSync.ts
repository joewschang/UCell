import type {NavigateFunction} from 'react-router-dom';
/** Call only after the authentication bootstrap has validated the callback. */
export function syncMemberLocation(navigate:NavigateFunction){
 const {pathname,search,hash}=window.location;
 navigate(pathname+(search||'')+(hash||''),{replace:true});
}
