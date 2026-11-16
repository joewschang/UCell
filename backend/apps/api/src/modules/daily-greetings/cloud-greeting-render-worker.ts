import {parentPort,workerData} from 'node:worker_threads';
import {Resvg} from '@resvg/resvg-js';
import {imageType} from './greeting-upload';
import {greetingBrandSvg} from './greeting-brand';
import {cloudCopy} from './cloud-greeting-policy';
import {escapeHtml} from './daily-greeting';
try{
 const png=Buffer.from(workerData.background);imageType(png,8_000_000);
 if(png.readUInt32BE(16)<1024||png.readUInt32BE(20)<1024)throw Error('low resolution');
 const title=cloudCopy(workerData.date).title;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><image href="data:image/png;base64,${png.toString('base64')}" width="1080" height="880" preserveAspectRatio="xMidYMid slice"/><rect x="540" y="60" width="490" height="200" rx="28" fill="#fffdf7" fill-opacity=".9"/><text x="785" y="150" text-anchor="middle" font-family="Noto Sans CJK TC" font-size="60" font-weight="700" fill="#244d43">${escapeHtml(title)}</text><text x="785" y="220" text-anchor="middle" font-family="Noto Sans CJK TC" font-size="27" fill="#456258">${workerData.date}</text>${greetingBrandSvg()}</svg>`;
 const result=Buffer.from(new Resvg(svg,{font:{fontFiles:[workerData.font],loadSystemFonts:false,defaultFontFamily:'Noto Sans CJK TC'}}).render().asPng());
 if(result.length>3_000_000)throw Error('stored image limit');parentPort!.postMessage({image:result});
}catch{parentPort!.postMessage({error:true});}
