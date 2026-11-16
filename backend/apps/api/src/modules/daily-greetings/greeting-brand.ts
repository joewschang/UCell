import {readFileSync} from 'node:fs';
import {join} from 'node:path';
export const OFFICIAL_LINE_URL='https://lin.ee/pqS11xX';
const cached=new Map<string,string>();
const uri=(name:string)=>{let value=cached.get(name);if(!value){value='data:image/png;base64,'+readFileSync(join(__dirname,'assets',name)).toString('base64');cached.set(name,value);}return value;};
/** Verified unmodified admin wordmark; QR is statically encoded and decode-tested. */
export function greetingBrandSvg():string{
return '<rect x="0" y="880" width="1080" height="200" fill="#fffdf8"/><image href="'+uri('ucell-simple-logo.png')+'" x="52" y="940" width="260" height="90" preserveAspectRatio="xMidYMid meet"/><image href="'+uri('ucell-line-qr.png')+'" x="864" y="888" width="184" height="184"/>';
}
