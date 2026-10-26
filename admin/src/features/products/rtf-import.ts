import type {ProductDocument,Run} from '../../../../shared/product-content/Document';
/** Text/basic-format import only. Never executes fields or includes embedded objects. */
export function importRtf(bytes:Uint8Array):{document:ProductDocument;omittedMedia:boolean}{
 if(bytes.length>1048576)throw Error('RTF 檔案限 1 MB。');const source=new TextDecoder('latin1').decode(bytes);if(!/^\{\\rtf\d/.test(source))throw Error('這不是有效的 RTF 檔案。');
 type State={bold:boolean;italic:boolean;underline:boolean;skip:boolean;uc:number;encoding:string};let state:State={bold:false,italic:false,underline:false,skip:false,uc:1,encoding:'windows-1252'},stack:State[]=[],fallback=0,omittedMedia=false,depth=0,total=0;const blocks:ProductDocument['blocks']=[],runs:Run[]=[];
 function text(s:string){if(state.skip)return;if(fallback){const n=Math.min(fallback,s.length);s=s.slice(n);fallback-=n;}if(!s)return;total+=s.length;if(total>50000)throw Error('RTF 文字超過 50,000 字，請分段上稿。');const last=runs[runs.length-1];if(last&&!!last.bold===state.bold&&!!last.italic===state.italic&&!!last.underline===state.underline)last.text+=s;else runs.push({text:s,...(state.bold?{bold:true}:{}),...(state.italic?{italic:true}:{}),...(state.underline?{underline:true}:{})});}
 function paragraph(){if(!state.skip&&runs.length){blocks.push({type:'paragraph',runs:runs.splice(0)});if(blocks.length>100)throw Error('RTF 段落超過 100 段，請分段上稿。');}}
 for(let i=0;i<source.length;){const c=source[i++];if(c==='{'){stack.push({...state});if(++depth>100)throw Error('RTF 結構過於複雜。');continue;}if(c==='}'){if(!stack.length)throw Error('RTF 結構不完整。');state=stack.pop()!;depth--;continue;}if(c==='\r'||c==='\n')continue;if(c!=='\\'){text(c);continue;}
  const next=source[i++];if(next==='\\'||next==='{'||next==='}'){text(next);continue;}if(next==='*'){state.skip=true;continue;}if(next==="'"){const octets=[];i--;while(source[i]==="'"&&/^[a-f\d]{2}$/i.test(source.slice(i+1,i+3))){octets.push(parseInt(source.slice(i+1,i+3),16));i+=3;if(source[i]==='\\'&&source[i+1]==="'")i++;else break;}if(!octets.length)throw Error('RTF 字元編碼不正確。');if(fallback){const n=Math.min(fallback,octets.length);octets.splice(0,n);fallback-=n;}if(octets.length)text(new TextDecoder(state.encoding).decode(new Uint8Array(octets)));continue;}
  if(next==='~'){text('\u00a0');continue;}if(next==='-'){continue;}if(next==='_'){text('‑');continue;}
  if(!/[a-z]/i.test(next??''))continue;let word=next;while(/[a-z]/i.test(source[i]??'')&&i<source.length)word+=source[i++];let value='';if(source[i]==='-')value+=source[i++];while(i<source.length&&/[0-9]/.test(source[i]))value+=source[i++];if(source[i]===' ')i++;const n=value?Number(value):1;
  if(['fonttbl','colortbl','stylesheet','info','pict','object','header','footer','listtable','listoverridetable','fldinst','generator'].includes(word)){state.skip=true;if(['pict','object'].includes(word))omittedMedia=true;continue;}
  if(word==='bin'){if(n<0||i+n>source.length)throw Error('RTF 二進位區段不完整。');i+=n;omittedMedia=true;continue;}
  if(word==='ansicpg'){const enc:Record<number,string>={950:'big5',936:'gbk',932:'shift_jis',1252:'windows-1252',65001:'utf-8'};if(!enc[n])throw Error('此 RTF 字元編碼不支援，請改用 Unicode RTF 或貼上文字。');state.encoding=enc[n];}
  if(word==='uc')state.uc=Math.max(0,Math.min(10,n));if(word==='u'){const old=fallback;fallback=0;text(String.fromCharCode(n<0?n+65536:n));fallback=state.skip?old:state.uc;}
  if(word==='b')state.bold=n!==0;if(word==='i')state.italic=n!==0;if(word==='ul')state.underline=n!==0;if(word==='ulnone')state.underline=false;if(word==='plain'){state.bold=false;state.italic=false;state.underline=false;}
  if(word==='par')paragraph();if(word==='line')text('\n');if(word==='tab')text('\t');if(word==='emdash')text('—');if(word==='endash')text('–');if(word==='bullet')text('•');
 }
 if(depth!==0)throw Error('RTF 檔案不完整。');paragraph();if(!blocks.length)throw Error('RTF 中沒有可匯入的文字。');return {document:{blocks},omittedMedia};
}
