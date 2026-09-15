import {PublicClientApplication} from '@azure/msal-browser';

const clientId=import.meta.env.VITE_ENTRA_CLIENT_ID;
const tenantId=import.meta.env.VITE_ENTRA_TENANT_ID;
const redirectUri=import.meta.env.VITE_ENTRA_REDIRECT_URI || `${window.location.origin}/login`;

export const entraConfigured=Boolean(clientId&&tenantId);

let instance:PublicClientApplication|undefined;
export async function entraClient(){
  if(!entraConfigured)throw new Error('Entra尚未設定');
  if(!instance){
    instance=new PublicClientApplication({
      auth:{
        clientId,
        authority:`https://login.microsoftonline.com/${tenantId}`,
        redirectUri,
      },
      cache:{cacheLocation:'sessionStorage'}
    });
    await instance.initialize();
  }
  return instance;
}

export async function acquireEntraIdToken(){
  const client=await entraClient();
  const result=await client.loginPopup({
    scopes:['openid','profile','email'],
    prompt:'select_account'
  });
  if(!result.idToken)throw new Error('Microsoft登入未回傳ID Token');
  return result.idToken;
}

export async function entraLogout(){
  if(!instance)return;
  const account=instance.getActiveAccount()??instance.getAllAccounts()[0];
  if(account)await instance.logoutPopup({account,postLogoutRedirectUri:`${window.location.origin}/login`});
}
