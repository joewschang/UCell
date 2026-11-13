import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
/** Reviewed, bundled photographs. No runtime fetching, credentials or member data. */
export type GreetingPhoto={id:string;file:string;label:string;category:string;title:string;author:string;sourcePage:string;sourceUrl:string;license:string;licenseUrl:string;width:number;height:number;sha256:string;reviewedAt:string;modification:string};
let catalog:readonly GreetingPhoto[]|undefined;
/** A missing photo package must fail the greeting job, not crash the entire API on import. */
export function greetingPhotos():readonly GreetingPhoto[]{
 return catalog??=JSON.parse(readFileSync(join(__dirname,'assets/photos/catalog.json'),'utf8'));
}
const cache=new Map<string,string>();
export function greetingPhoto(date:string):GreetingPhoto {
 const photos=greetingPhotos();
 const day=Date.parse(date+'T00:00:00Z')/86_400_000;
 if(!Number.isInteger(day)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(day*86_400_000).toISOString().slice(0,10)!==date)throw new Error('GREETING_PHOTO_DATE_INVALID');
 // Catalog interleaves six subjects: all ten photos appear before repeating.
 return photos[((day%photos.length)+photos.length)%photos.length];
}
export function greetingPhotoData(date:string):string {
 const photo=greetingPhoto(date),hit=cache.get(photo.id);if(hit)return hit;
 if(photo.license!=='CC0'||!/^[a-z0-9-]+\.jpeg$/.test(photo.file))throw new Error('GREETING_PHOTO_NOT_REVIEWED');
 const bytes=readFileSync(join(__dirname,'assets/photos',photo.file));
 if(bytes.length>3_000_000||createHash('sha256').update(bytes).digest('hex')!==photo.sha256)throw new Error('GREETING_PHOTO_INTEGRITY');
 const data='data:image/jpeg;base64,'+bytes.toString('base64');
 cache.set(photo.id,data);return data;
}
