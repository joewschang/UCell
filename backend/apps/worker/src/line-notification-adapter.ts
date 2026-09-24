export type LineSendOutcome={kind:'SENT';providerCorrelation:string}|{kind:'RETRY';code:string}|{kind:'FAILED';code:string};
export type LineNotificationSender={configured:boolean;send(input:{recipient:string;templateKey:string;correlationId:string}):Promise<LineSendOutcome>};
/** Deliberate fail-closed boundary: no access token means no outbound network request. */
export function lineNotificationSender(environment:NodeJS.ProcessEnv=process.env,request:typeof fetch=fetch):LineNotificationSender{
 const token=environment.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
 if(!token)return {configured:false,async send(){return {kind:'FAILED',code:'LINE_SENDER_CONFIGURATION_PENDING'};}};
 return {configured:true,async send(input){
  const response=await request('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Line-Retry-Key':input.correlationId},body:JSON.stringify({to:input.recipient,messages:[{type:'text',text:input.templateKey}]})});
  if(response.ok)return {kind:'SENT',providerCorrelation:response.headers.get('x-line-request-id')??input.correlationId};
  if(response.status===429||response.status>=500)return {kind:'RETRY',code:`LINE_HTTP_${response.status}`};
  return {kind:'FAILED',code:`LINE_HTTP_${response.status}`};
 }};
}