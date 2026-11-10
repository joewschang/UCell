import { Body, ConflictException, Controller, Get, Inject, Injectable, OnModuleInit, Post, Req, UseGuards, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { Roles } from '../auth/roles.decorator';
import { MemberAuthenticationGuard } from '../auth/member-authentication.guard';
import { ContentService } from './content.service';

const initial = {
  open: true, tags: ['腿部肌力','骨骼健康','日常觀察','居家活動'],
  links: { game: ['腿部肌力','骨骼健康','日常觀察','居家活動'], guide: ['腿部肌力','日常觀察'], bone: ['骨骼健康','日常觀察'] } as Record<string,string[]>,
};
type Settings = typeof initial;
type Resource = {id:string; title:string; kind:string; href:string};
const basics: Resource[] = [
  {id:'game',title:'居家腿力與骨骼自我觀察',kind:'遊戲',href:'?play=1'},
  {id:'guide',title:'觀察前，先準備椅子和空間',kind:'內容',href:'?read=guide'},
  {id:'bone',title:'整理身高與回診問題',kind:'內容',href:'?read=bone'},
];

@Injectable()
export class HealthGameService implements OnModuleInit {
  constructor(@Inject(PrismaService) private db: PrismaService, @Inject(ContentService) private content: ContentService) {}
  async onModuleInit(){
    await this.db.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(261110045)`;
      await tx.$executeRaw`CREATE TABLE IF NOT EXISTS integration.health_game_config (id integer PRIMARY KEY, version integer NOT NULL, config jsonb NOT NULL)`;
      await tx.$executeRaw`CREATE TABLE IF NOT EXISTS integration.health_game_audit (version integer PRIMARY KEY, actor text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now(), config jsonb NOT NULL)`;
      await tx.$executeRaw`CREATE TABLE IF NOT EXISTS integration.health_game_week (person_id uuid NOT NULL, week date NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, PRIMARY KEY(person_id,week))`;
      await tx.$executeRaw`INSERT INTO integration.health_game_config VALUES (1,1,${JSON.stringify(initial)}::jsonb) ON CONFLICT DO NOTHING`;
    });
  }
  async config(){
    const [row]=await this.db.$queryRaw<{version:number;config:Settings}[]>`SELECT version,config FROM integration.health_game_config WHERE id=1`;
    return row;
  }
  async resources(person?:string,admin=false):Promise<Resource[]> {
    const rows=[...basics];
    if(!admin && !person)return rows;
    const content=admin ? (await this.content.adminList()).filter(c=>c.status==='PUBLISHED').map(c=>({id:c.id,title:c.versions.find(v=>v.status==='PUBLISHED')?.title})) : await this.content.list(person!);
    for(const c of content)if(c.title)rows.push({id:'content:'+c.id,title:c.title,kind:'內容',href:'/content/'+encodeURIComponent(c.id)});
    const products=await this.db.productReference.findMany({where:{isActive:true},select:{sku:true,displayName:true},orderBy:{sku:'asc'}});
    for(const p of products)rows.push({id:'sku:'+p.sku,title:p.displayName+' · '+p.sku,kind:'商品',href:'/shop?sku='+encodeURIComponent(p.sku)});
    return rows;
  }
  async view(person?:string,admin=false){
    const {version,config}=await this.config();
    if(!admin && !config.open)return {open:false};
    const resources=(await this.resources(person,admin)).map(r=>({...r,tags:config.links[r.id]||[]}));
    const weeks=person ? await this.db.$queryRaw<{week:string}[]>`SELECT week::text FROM integration.health_game_week WHERE person_id=${person}::uuid AND completed_at IS NOT NULL ORDER BY week DESC` : [];
    if(!admin)return {open:true,tags:config.tags,resources:resources.filter(r=>r.tags.length || r.id==='game'),weeks:weeks.map(w=>w.week)};
    const [stats]=await this.db.$queryRaw<{started:number;finished:number}[]>`SELECT count(*)::int AS started,count(completed_at)::int AS finished FROM integration.health_game_week`;
    return {...config,version,resources,stats};
  }
  async save(body:any,actor:string){
    if(!body||!Number.isInteger(body.version)||typeof body.open!=='boolean'||!Array.isArray(body.tags)||body.tags.length>50||body.tags.some((v:unknown)=>typeof v!=='string'||!/^[-\p{L}\p{N}]{1,18}$/u.test(v))||new Set(body.tags).size!==body.tags.length||!body.links||typeof body.links!=='object'||Array.isArray(body.links))throw new UnprocessableEntityException('標籤格式錯誤');
    const resources=new Set((await this.resources(undefined,true)).map(r=>r.id));
    for(const [id,tags] of Object.entries(body.links)){
      if(!resources.has(id)||!Array.isArray(tags)||new Set(tags).size!==tags.length||tags.some(v=>!body.tags.includes(v)))throw new UnprocessableEntityException('請重新整理資源與標籤');
    }
    const json=JSON.stringify({open:body.open,tags:body.tags,links:body.links});
    await this.db.$transaction(async tx=>{
      const n=await tx.$executeRaw`UPDATE integration.health_game_config SET config=${json}::jsonb,version=version+1 WHERE id=1 AND version=${body.version}`;
      if(!n)throw new ConflictException('其他管理者已更新，請重新載入');
      await tx.$executeRaw`INSERT INTO integration.health_game_audit(version,actor,config) VALUES (${body.version+1},${actor},${json}::jsonb)`;
    });
    return {saved:true};
  }
  async play(person:string,finish:boolean){
    return this.db.$transaction(async tx=>{
      const [cfg]=await tx.$queryRaw<{enabled:boolean}[]>`SELECT (config->>'open')::boolean AS enabled FROM integration.health_game_config WHERE id=1 FOR SHARE`;
      if(!cfg.enabled)throw new ConflictException('活動已暫停');
      // Database clock determines the Taipei calendar week.
      if(!finish)await tx.$executeRaw`INSERT INTO integration.health_game_week(person_id,week) VALUES (${person}::uuid,date_trunc('week',now() AT TIME ZONE 'Asia/Taipei')::date) ON CONFLICT DO NOTHING`;
      else {
        const n=await tx.$executeRaw`UPDATE integration.health_game_week SET completed_at=coalesce(completed_at,now()) WHERE person_id=${person}::uuid AND week=date_trunc('week',now() AT TIME ZONE 'Asia/Taipei')::date`;
        if(!n)throw new ConflictException('請重新開始本週任務');
      }
      return {completed:finish};
    });
  }
}
@Controller('public/health-game')
export class PublicHealthGame {
  constructor(@Inject(HealthGameService) private service:HealthGameService){}
  @Get() view(){return this.service.view();}
}
@Controller('member/health-game')
@UseGuards(MemberAuthenticationGuard)
export class MemberHealthGame {
  constructor(@Inject(HealthGameService) private service:HealthGameService){}
  @Get() view(@Req() r:any){return this.service.view(r.user.personId);}
  @Post('start') start(@Req() r:any){return this.service.play(r.user.personId,false);}
  @Post('finish') finish(@Req() r:any){return this.service.play(r.user.personId,true);}
}
@Controller('admin/health-game')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS')
export class AdminHealthGame {
  constructor(@Inject(HealthGameService) private service:HealthGameService){}
  @Get() view(){return this.service.view(undefined,true);}
  @Post() save(@Body() body:any,@Req() req:any){return this.service.save(body,req.user.personId??req.user.subject);}
}
