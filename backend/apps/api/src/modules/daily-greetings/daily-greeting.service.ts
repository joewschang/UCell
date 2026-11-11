import {Injectable,Logger,NotFoundException,OnApplicationBootstrap,OnModuleDestroy,ServiceUnavailableException} from '@nestjs/common';
import {renderGreeting} from './render-greeting';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {GREETING_VERSION,TIME_ZONE,escapeHtml,greetingCopy,greetingDate,greetingSvg,greetingWindow,validGreetingDate} from './daily-greeting';

function findFont(directory='/usr/share/fonts',depth=0):string|undefined {
 if(depth>4||!existsSync(directory))return;
 for(const entry of readdirSync(directory,{withFileTypes:true})){
  const path=join(directory,entry.name);
  if(entry.isFile()&&/^NotoSansCJK-Regular\.(ttc|otf)$/i.test(entry.name))return path;
  if(entry.isDirectory()){const found=findFont(path,depth+1);if(found)return found;}
 }
}
@Injectable()
export class DailyGreetingService implements OnApplicationBootstrap,OnModuleDestroy {
 private readonly logger=new Logger(DailyGreetingService.name);
 private timer?:ReturnType<typeof setTimeout>;
 private readonly images=new Map<string,Buffer>();
 private font?:string;
 private destroyed=false;
 private logo?:string;
 private readonly pending=new Map<string,Promise<Buffer>>();
 private renderTail:Promise<unknown>=Promise.resolve();
 private base(){
  const raw=process.env.DAILY_GREETING_PUBLIC_API_BASE_URL??'https://api.ucell.life/api/v1';
  let value:URL;try{value=new URL(raw);}catch{throw new ServiceUnavailableException({code:'GREETING_PUBLIC_URL_INVALID'});}
  if(value.protocol!=='https:'||value.username||value.password||value.search||value.hash)throw new ServiceUnavailableException({code:'GREETING_PUBLIC_URL_INVALID'});
  return value.toString().replace(/\/$/,'');
 }
 private assertDate(date:string,now:Date){if(!validGreetingDate(date,now))throw new NotFoundException({code:'GREETING_NOT_AVAILABLE'});}
 metadata(date:string,now=new Date()){
  this.assertDate(date,now);const copy=greetingCopy(date),base=this.base();
  return {date,title:copy.title,message:copy.lines.join('，'),category:copy.category,imageUrl:`${base}/public/daily-greetings/${date}/image.png`,shareUrl:`${base}/public/daily-greetings/${date}/share`,...greetingWindow(date),timeZone:TIME_ZONE,renderer:GREETING_VERSION};
 }
 async current(at?:Date):Promise<ReturnType<DailyGreetingService['metadata']>>{
  const now=at??new Date(),date=greetingDate(now);await this.image(date,now); // Do not advertise an unrenderable poster.
  // Rendering can cross the release boundary; never send an already expired window.
  if(!at&&greetingDate()!==date)return this.current();
  return this.metadata(date,now);
 }
 async image(date:string,now=new Date()):Promise<Buffer> {
  if(this.destroyed)throw new ServiceUnavailableException({code:'GREETING_SHUTTING_DOWN'});
  this.assertDate(date,now);const hit=this.images.get(date);if(hit)return hit;
  const running=this.pending.get(date);if(running)return running;
  this.font??=process.env.DAILY_GREETING_FONT_PATH??findFont();
  if(!this.font||!existsSync(this.font))throw new ServiceUnavailableException({code:'GREETING_CJK_FONT_MISSING'});
  // One native renderer at a time, with at most four distinct pending dates.
  // Repeated concurrent requests share the same Promise; no unbounded CPU/queue.
  if(this.pending.size>=4)throw new ServiceUnavailableException({code:'GREETING_RENDER_BUSY'});
  const font=this.font;
  try{this.logo??='data:image/jpeg;base64,'+readFileSync(join(__dirname,'assets/ucell-official-logo.jpeg')).toString('base64');}
  catch{throw new ServiceUnavailableException({code:'GREETING_OFFICIAL_LOGO_MISSING'});}
  const logo=this.logo;
  const job=this.renderTail.then(async()=>{
   if(this.destroyed)throw new ServiceUnavailableException({code:'GREETING_SHUTTING_DOWN'});
   let png:Buffer;
   try{png=await renderGreeting(greetingSvg(date,logo),font);}catch{throw new ServiceUnavailableException({code:'GREETING_RENDER_FAILED'});}
   if(this.images.size>=32)this.images.delete(this.images.keys().next().value!);
   this.images.set(date,png);return png;
  }).finally(()=>{this.pending.delete(date);});
  this.pending.set(date,job);this.renderTail=job.catch(()=>undefined);return job;
 }
 async shareHtml(date:string,now=new Date()){
  await this.image(date,now);const d=this.metadata(date,now),e=escapeHtml;
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(d.title)}｜UCell 宇生國際</title><meta name="description" content="${e(d.message)}"><meta property="og:type" content="website"><meta property="og:site_name" content="UCell 宇生國際"><meta property="og:title" content="${e(d.title)}"><meta property="og:description" content="${e(d.message)}"><meta property="og:url" content="${e(d.shareUrl)}"><meta property="og:image" content="${e(d.imageUrl)}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1080"><meta property="og:image:height" content="1080"><meta property="og:image:alt" content="${e(d.title+'。'+d.message)}"><meta name="robots" content="noindex"><style>body{margin:0;padding:24px;background:#eff8f3;color:#143f3e;font-family:system-ui,sans-serif;text-align:center}main{max-width:640px;margin:auto}img{width:100%;height:auto;border-radius:20px}a{display:inline-block;padding:12px;color:inherit}p{line-height:1.8}</style></head><body><main><h1>${e(d.title)}</h1><img src="${e(d.imageUrl)}" alt="${e(d.title+'。'+d.message)}" width="1080" height="1080"><p>${e(d.message)}</p><a href="${e(d.imageUrl)}" download="UCell-${date}.png">儲存圖片</a><p>若未開始下載，請開啟圖片後長按儲存。</p><small>UCell 宇生國際 · ${date}</small></main></body></html>`;
 }
 onApplicationBootstrap(){void this.warm();}
 private async warm(){
  if(this.destroyed)return;
  try{const result=await this.current();if(this.destroyed)return;this.logger.log(`Daily greeting ready: ${result.date} (${GREETING_VERSION})`);}catch{if(!this.destroyed)this.logger.error('Daily greeting unavailable; check font and public URL configuration.');}
  if(this.destroyed)return;
  // Starts immediately and switches at 07:00 Taipei even after restarts or missed timers.
  const now=new Date(),next=Date.parse(greetingWindow(greetingDate(now)).nextRefreshAt);
  this.timer=setTimeout(()=>{void this.warm();},Math.max(1000,next-now.getTime()));this.timer.unref();
 }
 onModuleDestroy(){this.destroyed=true;if(this.timer)clearTimeout(this.timer);}
}
