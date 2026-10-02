import {Injectable,Logger,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {GeoProfileService} from './geo-profile.service';

/** Bounded, restart-safe backfill of immutable approval evidence. Repeated cycles catch
 * new randomly ordered audit UUIDs; per-member database locks make replicas idempotent.
 */
@Injectable()
export class GeoProfileRefreshRunner implements OnModuleInit,OnModuleDestroy {
 private readonly logger=new Logger(GeoProfileRefreshRunner.name);
 private timer?:ReturnType<typeof setInterval>;
 private cursor?:string;
 private running=false;
 constructor(private readonly profiles:GeoProfileService){}
 onModuleInit(){
  if(process.env.GEO_PROFILE_REFRESH_ENABLED!=='true')return;
  this.timer=setInterval(()=>void this.tick(),60000);this.timer.unref();
  void this.tick();
 }
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async tick(){
  if(this.running)return;this.running=true;
  try{
   const result=await this.profiles.refresh(this.cursor);
   this.cursor=result.nextCursor??undefined;
   if(result.created)this.logger.log({event:'GEO_PROFILE_REFRESH',created:result.created,skipped:result.skipped});
  }catch{
   // Never log decrypted source material, transport details or credential values.
   this.logger.error({event:'GEO_PROFILE_REFRESH_FAILED',code:'GEO_PROFILE_REFRESH_RETRY_REQUIRED'});
  }finally{this.running=false;}
 }
}
