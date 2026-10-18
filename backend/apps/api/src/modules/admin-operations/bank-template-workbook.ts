import {readFileSync} from 'node:fs';
import {join} from 'node:path';
// CFB preserves all non-workbook streams, including the bank's native template metadata.
const CFB=require('cfb');
type Cell={row:number;col:number;value:string|number};
type RecordPart={id:number;data:Buffer};
function records(input:Buffer){const result:RecordPart[]=[];for(let at=0;at<input.length;){if(at+4>input.length)throw Error('BANK_TEMPLATE_TRUNCATED');const id=input.readUInt16LE(at),size=input.readUInt16LE(at+2);if(at+4+size>input.length)throw Error('BANK_TEMPLATE_TRUNCATED');result.push({id,data:Buffer.from(input.subarray(at+4,at+4+size))});at+=4+size;}return result;}
function pack(parts:RecordPart[]){return Buffer.concat(parts.map(p=>{const h=Buffer.alloc(4);h.writeUInt16LE(p.id);h.writeUInt16LE(p.data.length,2);return Buffer.concat([h,p.data]);}));}
function cellRecord(cell:Cell,xf:number):RecordPart{const h=Buffer.alloc(6);h.writeUInt16LE(cell.row);h.writeUInt16LE(cell.col,2);h.writeUInt16LE(xf,4);if(typeof cell.value==='number'){const n=Buffer.alloc(8);n.writeDoubleLE(cell.value);return {id:0x203,data:Buffer.concat([h,n])};}const text=Buffer.from(cell.value,'utf16le'),length=Buffer.alloc(3);length.writeUInt16LE(cell.value.length);length[2]=1;return {id:0x204,data:Buffer.concat([h,length,text])};}
/** Patch input/output cells in the original BIFF8 file, retaining sheets, formatting and unrelated formulas. */
export function fillBankTemplate(template:'bulk-remittance'|'center-transfer',updates:Record<string,Cell[]>){
 const original=readFileSync(join(__dirname,'bank-templates',template+'.xls'));
 const container=CFB.read(original,{type:'buffer'}),entry=CFB.find(container,'Workbook')??CFB.find(container,'Book');if(!entry)throw Error('BANK_TEMPLATE_WORKBOOK_MISSING');
 const bytes=Buffer.from(entry.content),all=records(bytes),bound=all.filter(r=>r.id===0x85);
 const names=bound.map(r=>r.data.subarray(8).toString(r.data[7]&1?'utf16le':'latin1').slice(0,r.data[6]));
 const offsets=bound.map(r=>r.data.readUInt32LE(0));
 const globals=records(bytes.subarray(0,offsets[0]));
 const sheets=offsets.map((offset,index)=>{
  const sheet=records(bytes.subarray(offset,offsets[index+1]??bytes.length)),cells=updates[names[index]]??[];
  if(!cells.length)return pack(sheet);
  const wanted=new Map(cells.map(c=>[`${c.row}:${c.col}`,c])),styles=new Map<string,number>();
  const kept:RecordPart[]=[];let skipString=false;
  for(const r of sheet){
   if(skipString&&r.id===0x207){skipString=false;continue;}skipString=false;
   // Optional row indexes contain byte offsets. Excel rebuilds them on save.
   if([0x20b,0xd7].includes(r.id))continue;
   if(r.id===0xbe||r.id===0xbd){const row=r.data.readUInt16LE(),first=r.data.readUInt16LE(2),last=r.data.readUInt16LE(r.data.length-2),stride=r.id===0xbe?2:6;for(let col=first;col<=last;col++){const at=4+(col-first)*stride,xf=r.data.readUInt16LE(at),key=`${row}:${col}`;styles.set(key,xf);if(wanted.has(key))continue;const h=Buffer.alloc(6);h.writeUInt16LE(row);h.writeUInt16LE(col,2);h.writeUInt16LE(xf,4);kept.push({id:r.id===0xbe?0x201:0x27e,data:r.id===0xbe?h:Buffer.concat([h,r.data.subarray(at+2,at+6)])});}continue;}
   if([0x201,0x203,0x204,0xfd,0x27e,0x205,0x6].includes(r.id)&&r.data.length>=6){const key=`${r.data.readUInt16LE()}:${r.data.readUInt16LE(2)}`;styles.set(key,r.data.readUInt16LE(4));if(wanted.has(key)){skipString=r.id===0x6;continue;}}
   if(r.id===0x200){r.data.writeUInt32LE(Math.max(r.data.readUInt32LE(4),...cells.map(c=>c.row+1)),4);r.data.writeUInt16LE(Math.max(r.data.readUInt16LE(10),...cells.map(c=>c.col+1)),10);}
   if(r.id===0xa){for(const cell of cells)kept.push(cellRecord(cell,styles.get(`${cell.row}:${cell.col}`)??styles.get(`2:${cell.col}`)??styles.get(`1:${cell.col}`)??0));}
   kept.push(r);
  }return pack(kept);
 });
 let offset=pack(globals).length,index=0;for(const r of globals)if(r.id===0x85){r.data.writeUInt32LE(offset);offset+=sheets[index++].length;}
 const content=Buffer.concat([pack(globals),...sheets]);entry.content=content;entry.size=content.length;
 return Buffer.from(CFB.write(container,{type:'buffer'}));
}
