import {Injectable,ServiceUnavailableException} from '@nestjs/common';
import {cloudConfiguration,cloudPrompt} from './cloud-greeting-policy';
@Injectable()
export class CloudGreetingProvider {
 async generate(date:string):Promise<Buffer>{
  const c=cloudConfiguration(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90_000);
  try{
   const response=await fetch(`${c.endpoint}/openai/deployments/${encodeURIComponent(c.deployment)}/images/generations?api-version=2025-04-01-preview`,{method:'POST',redirect:'error',signal:controller.signal,headers:{'api-key':c.key,'Content-Type':'application/json'},body:JSON.stringify({prompt:cloudPrompt(date),n:1,size:'1024x1024',quality:'medium',output_format:'png'})});
   if(!response.ok||!response.body)throw new Error('provider failed');
   const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>12_000_000)throw new Error('response size');chunks.push(value);}}finally{await reader.cancel().catch(()=>undefined);}
   const data=JSON.parse(Buffer.concat(chunks).toString('utf8')),image=data?.data?.[0]?.b64_json;
   if(data?.data?.length!==1||typeof image!=='string'||image.length%4!==0||image.length>11_000_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(image))throw new Error('invalid image');
   return Buffer.from(image,'base64');
  }catch{throw new ServiceUnavailableException({code:'GREETING_IMAGE_PROVIDER_FAILED'});}finally{clearTimeout(timer);}
 }
}
