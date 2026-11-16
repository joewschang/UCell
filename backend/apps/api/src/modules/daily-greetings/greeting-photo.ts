import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {greetingBrandSvg} from './greeting-brand';
const cached=new Map<string,string>();
const uri=(name:string)=>{let value=cached.get(name);if(!value){value='data:image/png;base64,'+readFileSync(join(__dirname,'assets',name)).toString('base64');cached.set(name,value);}return value;};
export function greetingPhotoSvg(title:string,date:string):string{
return '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><image href="'+uri('sunday-kitten-background.png')+'" x="0" y="0" width="1080" height="880" preserveAspectRatio="xMidYMid slice"/><rect x="540" y="70" width="490" height="210" rx="28" fill="#fffdf7" fill-opacity=".88"/><text x="785" y="170" text-anchor="middle" font-family="Noto Sans CJK TC" font-size="64" font-weight="700" fill="#244d43">'+title+'</text><text x="785" y="234" text-anchor="middle" font-family="Noto Sans CJK TC" font-size="27" fill="#456258">'+date+'</text>'+greetingBrandSvg()+'</svg>';
}
