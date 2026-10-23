import {isDeepStrictEqual} from 'node:util';
import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {randomUUID,createHash} from 'node:crypto';
import {FormalKycStorageService} from './formal-kyc-storage.service';
import {AuditService} from '../../common/audit/audit.service';
import {contentDocument,contentMediaIds} from './product-content-format';
import {REVIEW_MIMES,MEDIA_PART_SIZE,decodeReviewPart,validReviewMedia,reviewMediaLimit} from './product-review-media';
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
@Injectable()
export class ProductContentService{
 constructor(private readonly db:PrismaService,private readonly storage:FormalKycStorageService,private readonly audit:AuditService){}
 private async product(sku:string){const p=await this.db.productReference.findUnique({where:{sku}});if(!p)throw new NotFoundException();return p;}
 private metadata(m:any){return {id:m.media_id,mimeType:m.mime_type,size:m.byte_size};}
 async read(sku:string,admin=false){const p=await this.product(sku);if(!admin&&!p.isActive)throw new NotFoundException();
  const [row]=await this.db.$queryRaw<any[]>`SELECT * FROM commerce.product_content WHERE product_id=${p.productId}::uuid`;
  const document=admin?row?.draft:row?.published,ids=contentMediaIds(document??{blocks:[]});
  const media=admin?await this.db.$queryRaw<any[]>`SELECT * FROM commerce.product_content_media WHERE product_id=${p.productId}::uuid AND status='READY' ORDER BY created_at DESC LIMIT 100`:ids.length?await this.db.$queryRaw<any[]>(Prisma.sql`SELECT * FROM commerce.product_content_media WHERE media_id IN (${Prisma.join(ids.map(id=>Prisma.sql`${id}::uuid`))}) AND status='READY'`):[];
  return {sku:p.sku,name:p.displayName,price:p.currentPrice?.toString()??null,available:p.isActive,coverImage:p.iconUrl&&/^\/products\/[a-z0-9_.-]+$/i.test(p.iconUrl)?p.iconUrl:null,document:document??{blocks:[]},media:media.map(m=>this.metadata(m)),publishedAt:row?.published_at?.toISOString()??null,...(admin?{version:row?.version??0,publishedVersion:row?.published_version??null,isPublished:!!row?.published}:{})};
 }
 private async validateMedia(tx:any,productId:string,doc:any){const ids=contentMediaIds(doc);if(!ids.length)return;const rows=await tx.$queryRaw(Prisma.sql`SELECT media_id,mime_type FROM commerce.product_content_media WHERE product_id=${productId}::uuid AND status='READY' AND media_id IN (${Prisma.join(ids.map(id=>Prisma.sql`${id}::uuid`))})`);if(rows.length!==ids.length||doc.blocks.some((b:any)=>b.mediaId&&!rows.some((m:any)=>m.media_id===b.mediaId&&m.mime_type.startsWith(b.type+'/'))))throw new BadRequestException({code:'PRODUCT_CONTENT_MEDIA_INVALID',message:'附件尚未完成上傳，或不屬於此商品。'});}
 async save(sku:string,value:any,version:number,actor:string,requestId:string){const p=await this.product(sku),doc=contentDocument(value);return this.db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT product_id FROM commerce.product_reference WHERE product_id=${p.productId}::uuid FOR UPDATE`;
  const [old]=await tx.$queryRaw<any[]>`SELECT * FROM commerce.product_content WHERE product_id=${p.productId}::uuid FOR UPDATE`;
  if((old?.version??0)!==version){if(old&&isDeepStrictEqual(old.draft,doc))return {version:old.version};throw new ConflictException({code:'PRODUCT_CONTENT_VERSION',message:'商品說明已被更新，請保留內容並重新載入比較。'});}
  await this.validateMedia(tx,p.productId,doc);const json=JSON.stringify(doc);
  await tx.$executeRaw`INSERT INTO commerce.product_content(product_id,draft,version,updated_by) VALUES(${p.productId}::uuid,${json}::jsonb,1,${actor}::uuid) ON CONFLICT(product_id) DO UPDATE SET draft=EXCLUDED.draft,version=product_content.version+1,updated_by=EXCLUDED.updated_by,updated_at=now()`;
  await this.audit.write(tx,{actorType:'ADMIN',actorId:actor,action:'PRODUCT_CONTENT_DRAFT_SAVED',entityType:'ProductContent',entityId:p.productId,afterData:{version:version+1,blocks:doc.blocks.length},requestId,correlationId:randomUUID()});return {version:version+1};
 });}
 async publish(sku:string,version:number,publish:boolean,actor:string,requestId:string){const p=await this.product(sku);return this.db.$transaction(async tx=>{
  const [row]=await tx.$queryRaw<any[]>`SELECT * FROM commerce.product_content WHERE product_id=${p.productId}::uuid FOR UPDATE`;
  if(!row||row.version!==version)throw new ConflictException({code:'PRODUCT_CONTENT_VERSION',message:'請先儲存最新草稿，再確認發布。'});
  if(publish){const doc=contentDocument(row.draft);if(!doc.blocks.some((b:any)=>b.mediaId||b.type==='youtube'||b.runs?.some((r:any)=>r.text.trim())))throw new BadRequestException({code:'PRODUCT_CONTENT_EMPTY',message:'請先加入商品說明內容。'});await this.validateMedia(tx,p.productId,doc);}
  await tx.$executeRaw`UPDATE commerce.product_content SET published=CASE WHEN ${publish} THEN draft ELSE NULL END,published_version=CASE WHEN ${publish} THEN version ELSE NULL END,published_at=CASE WHEN ${publish} THEN now() ELSE NULL END,updated_by=${actor}::uuid,updated_at=now() WHERE product_id=${p.productId}::uuid`;
  await this.audit.write(tx,{actorType:'ADMIN',actorId:actor,action:publish?'PRODUCT_CONTENT_PUBLISHED':'PRODUCT_CONTENT_UNPUBLISHED',entityType:'ProductContent',entityId:p.productId,afterData:{version,publish},requestId,correlationId:randomUUID()});return {published:publish,version};
 });}
 async start(sku:string,input:{mimeType:string;size:number;sha256:string},actor:string){const p=await this.product(sku);if(!REVIEW_MIMES.includes(input.mimeType)||input.size>reviewMediaLimit(input.mimeType))throw new BadRequestException({code:'PRODUCT_MEDIA_SIZE',message:'照片限 5 MB，影片及音訊限 20 MB。'});return this.db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${actor}))::text`;
  await tx.$executeRaw`DELETE FROM commerce.product_content_chunk WHERE media_id IN (SELECT media_id FROM commerce.product_content_media WHERE actor_id=${actor}::uuid AND status='UPLOADING' AND created_at<now()-interval '1 day')`;
  const [old]=await tx.$queryRaw<any[]>`SELECT * FROM commerce.product_content_media WHERE product_id=${p.productId}::uuid AND actor_id=${actor}::uuid AND sha256=${input.sha256}`;
  if(old){if(old.mime_type!==input.mimeType||old.byte_size!==input.size)throw new BadRequestException();if(old.status==='UPLOADING'&&old.created_at.getTime()<Date.now()-86400000)await tx.$executeRaw`UPDATE commerce.product_content_media SET created_at=now() WHERE media_id=${old.media_id}::uuid`;return {id:old.media_id,ready:old.status==='READY',partSize:MEDIA_PART_SIZE};}
  const [{count}]=await tx.$queryRaw<{count:number}[]>`SELECT count(*)::int AS count FROM commerce.product_content_media WHERE actor_id=${actor}::uuid AND created_at>now()-interval '1 day'`;if(count>=100)throw new BadRequestException({message:'今日附件上傳已達 100 個，請明日再試。'});
  const id=randomUUID();await tx.$executeRaw`INSERT INTO commerce.product_content_media(media_id,product_id,actor_id,mime_type,byte_size,sha256,object_key) VALUES(${id}::uuid,${p.productId}::uuid,${actor}::uuid,${input.mimeType},${input.size},${input.sha256},${'product-content/'+p.productId+'/'+id})`;return {id,ready:false,partSize:MEDIA_PART_SIZE};
 });}
 async part(id:string,part:number,content:string,actor:string){const bytes=decodeReviewPart(content),digest=hash(bytes);return this.db.$transaction(async tx=>{
  const [m]=await tx.$queryRaw<any[]>`SELECT * FROM commerce.product_content_media WHERE media_id=${id}::uuid AND actor_id=${actor}::uuid FOR UPDATE`;if(!m)throw new NotFoundException();if(m.status==='READY')return {ready:true};if(m.created_at.getTime()<Date.now()-86400000)throw new ConflictException({message:'上傳已逾期，請重新選取檔案。'});
  const expected=Math.min(MEDIA_PART_SIZE,m.byte_size-part*MEDIA_PART_SIZE);if(expected<=0||bytes.length!==expected)throw new BadRequestException();const [old]=await tx.$queryRaw<any[]>`SELECT sha256 FROM commerce.product_content_chunk WHERE media_id=${id}::uuid AND part=${part}`;if(old){if(old.sha256!==digest)throw new ConflictException();return {received:true};}
  await tx.$executeRaw`INSERT INTO commerce.product_content_chunk(media_id,part,content,sha256) VALUES(${id}::uuid,${part},${bytes},${digest})`;return {received:true};
 });}
 async complete(id:string,actor:string){const [m]=await this.db.$queryRaw<any[]>`SELECT * FROM commerce.product_content_media WHERE media_id=${id}::uuid AND actor_id=${actor}::uuid`;if(!m)throw new NotFoundException();if(m.status==='READY')return this.metadata(m);
  const parts=await this.db.$queryRaw<{part:number;content:Buffer}[]>`SELECT part,content FROM commerce.product_content_chunk WHERE media_id=${id}::uuid ORDER BY part`;
  if(parts.length!==Math.ceil(m.byte_size/MEDIA_PART_SIZE)||parts.some((p,i)=>p.part!==i))throw new ConflictException({message:'附件尚未上傳完整，請重試。'});const bytes=Buffer.concat(parts.map(p=>p.content));if(bytes.length!==m.byte_size||hash(bytes)!==m.sha256||!validReviewMedia(bytes,m.mime_type))throw new BadRequestException({message:'附件格式或內容不正確，請重新選擇檔案。'});
  await this.storage.put(m.object_key,bytes,m.mime_type);await this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT media_id FROM commerce.product_content_media WHERE media_id=${id}::uuid FOR UPDATE`;await tx.$executeRaw`UPDATE commerce.product_content_media SET status='READY' WHERE media_id=${id}::uuid`;await tx.$executeRaw`DELETE FROM commerce.product_content_chunk WHERE media_id=${id}::uuid`;});return this.metadata(m);
 }
 async media(id:string,admin=false){const [m]=await this.db.$queryRaw<any[]>`SELECT * FROM commerce.product_content_media WHERE media_id=${id}::uuid AND status='READY'`;if(!m)throw new NotFoundException();if(!admin){const [row]=await this.db.$queryRaw<any[]>`SELECT c.published FROM commerce.product_content c JOIN commerce.product_reference p USING(product_id) WHERE c.product_id=${m.product_id}::uuid AND p.is_active=true`;if(!row?.published||!contentMediaIds(row.published).includes(id))throw new NotFoundException();}if(!m.object_key.startsWith('product-content/'))throw new NotFoundException();const value=await this.storage.get(m.object_key);return {bytes:value.bytes,mimeType:m.mime_type};}
}
