import liff from '@line/liff';
export async function initLiff(){
  const id=import.meta.env.VITE_LIFF_ID;
  if(!id) return {mode:'mock' as const};
  await liff.init({liffId:id});
  if(!liff.isLoggedIn()){ liff.login(); return {mode:'redirect' as const}; }
  const token=liff.getIDToken();
  if(token) sessionStorage.setItem('ucell_line_id_token',token);
  return {mode:'liff' as const,profile:await liff.getProfile()};
}
