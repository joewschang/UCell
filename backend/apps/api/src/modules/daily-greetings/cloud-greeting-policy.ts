import {BadRequestException,ServiceUnavailableException} from '@nestjs/common';
import {greetingDate,greetingCopy} from './daily-greeting';
export const CLOUD_GREETING_POLICY='generated-photo-v1';
export function cloudDate(date:string,now=new Date()){
 if(date<'2026-11-17'||date!==greetingDate(now))throw new BadRequestException({code:'GREETING_GENERATION_DATE_NOT_ALLOWED'});
 return date;
}
export function cloudConfiguration(){
 if(process.env.DAILY_GREETING_CLOUD_ENABLED!=='true'||process.env.DAILY_GREETING_IMAGE_BUDGET_APPROVED!=='true')throw new ServiceUnavailableException({code:'GREETING_CLOUD_NOT_CONFIGURED'});
 const endpoint=process.env.AI_AZURE_ENDPOINT??'',deployment=process.env.DAILY_GREETING_IMAGE_DEPLOYMENT??'',key=process.env.AI_AZURE_KEY;
 if(!/^https:\/\/[a-z0-9-]+\.openai\.azure\.com\/?$/.test(endpoint)||!key||!/^[-a-zA-Z0-9_]{1,64}$/.test(deployment))throw new ServiceUnavailableException({code:'GREETING_IMAGE_MODEL_NOT_CONFIGURED'});
 const attempts=Number(process.env.DAILY_GREETING_IMAGE_MAX_ATTEMPTS??'1');if(!Number.isInteger(attempts)||attempts<1||attempts>3)throw new ServiceUnavailableException({code:'GREETING_IMAGE_BUDGET_INVALID'});
 return {endpoint:endpoint.replace(/\/$/,''),deployment,key,attempts};
}
export function cloudCopy(date:string){const copy=greetingCopy(date);return {title:copy.title.split(/[，、]/)[0],message:copy.lines[0],category:copy.category};}
export function cloudPrompt(date:string){
 const scenes=['a misty mountain lake with soft morning light','a sunlit garden with blooming flowers','a quiet coastal path and gentle sea','a small kitten resting among garden flowers','a forest stream with natural green foliage','a graceful still life of seasonal flowers'];
 const scene=scenes[Math.floor(Date.parse(date+'T00:00:00Z')/86400000)%scenes.length];
 return `Create a NEW photorealistic high-resolution greeting-card BACKGROUND, variation date ${date}: ${scene}. Natural photography, peaceful and warm, realistic detail, no identifiable people, no text, no lettering, no logos, no QR codes, no watermarks, no health or weather assertions. Leave clean quiet space at upper right for a short greeting. No violent, sexual, political or commercial product content. This is an original generated illustration, not a report of a real place or current weather.`;
}
