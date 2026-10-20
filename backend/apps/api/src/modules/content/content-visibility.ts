import {PrismaService} from '@ucell/database';

export function safeContentUrl(value:string|null|undefined){
 try{const url=new URL(value??'');return url.protocol==='https:'&&!url.username&&!url.password?url.toString():null;}catch{return null;}
}
/** Select the latest effective published version before applying audience/expiry.
 * A newer expired or restricted version must never resurrect an older version. */
export async function currentContent(db:Pick<PrismaService,'publishedContent'>,id:string,now=new Date()){
 const content=await db.publishedContent.findFirst({where:{contentId:id,status:'PUBLISHED'},include:{versions:{where:{status:'PUBLISHED',approvedAt:{not:null},OR:[{publishFrom:null},{publishFrom:{lte:now}}]},orderBy:{version:'desc'},take:1}}});
 const row=content?.versions[0];
 if(!content||!row||row.publishTo&&row.publishTo<=now||!safeContentUrl(row.externalUrl))return null;
 return {id:content.contentId,versionId:row.contentVersionId,type:content.contentType,title:row.title,summary:row.summary,url:safeContentUrl(row.externalUrl)!,thumbnailUrl:safeContentUrl(row.thumbnailUrl),audiencePolicy:row.audiencePolicy,shareable:row.shareable,publishedAt:row.approvedAt!.toISOString()};
}
