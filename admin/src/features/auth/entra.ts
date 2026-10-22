import {uiText} from "../../../../shared/design-system/i18n";
import {PublicClientApplication} from '@azure/msal-browser';

const clientId=import.meta.env.VITE_ENTRA_CLIENT_ID;
const tenantId=import.meta.env.VITE_ENTRA_TENANT_ID;
const redirectUri=import.meta.env.VITE_ENTRA_REDIRECT_URI || `${window.location.origin}/login`;

export const entraConfigured=Boolean(clientId&&tenantId);

let instance:PublicClientApplication|undefined;
let initializing:Promise<void>|undefined;
let redirectResult:ReturnType<PublicClientApplication['handleRedirectPromise']>|undefined;
export async function entraClient(){
  if(!entraConfigured)throw new Error(uiText("Entra尚未設定"));
  if(!instance){
    instance=new PublicClientApplication({
      auth:{
        clientId,
        authority:`https://login.microsoftonline.com/${tenantId}`,
        redirectUri,
        navigateToLoginRequestUrl:false,
      },
      cache:{cacheLocation:'sessionStorage'}
    });
    initializing=instance.initialize();
  }
  await initializing;
  return instance;
}

export async function completeEntraRedirect(){
  if(!entraConfigured)return null;
  const client=await entraClient();
  redirectResult??=client.handleRedirectPromise();
  const result=await redirectResult;
  if(!result)return null;
  if(!result.idToken)throw new Error(uiText("Microsoft登入未回傳ID Token"));
  client.setActiveAccount(result.account);
  return result.idToken;
}

export async function startEntraLogin(){
  const client=await entraClient();
  // Complete callback processing before starting a new interaction.
  await completeEntraRedirect().catch(()=>null);
  await client.loginRedirect({
    scopes:['openid','profile','email'],
    prompt:'select_account'
  });
}

export async function entraLogout(){
  if(!instance)return;
  const account=instance.getActiveAccount()??instance.getAllAccounts()[0];
  if(account)await instance.logoutRedirect({account,postLogoutRedirectUri:`${window.location.origin}/login`});
}
