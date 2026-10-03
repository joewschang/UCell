// Container validation only: this never produces malware-scan CLEAN evidence.
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
function crc32(bytes:Buffer){
  let crc=0xffffffff;
  for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function png(bytes:Buffer){
  if(bytes.length<57||!bytes.subarray(0,8).equals(pngSignature))return false;
  let offset=8,header=false,data=false;
  while(offset+12<=bytes.length){
    const length=bytes.readUInt32BE(offset),end=offset+12+length;
    if(end>bytes.length)return false;
    const type=bytes.toString('ascii',offset+4,offset+8);
    if(!/^[A-Za-z]{4}$/.test(type)||bytes.readUInt32BE(end-4)!==crc32(bytes.subarray(offset+4,end-4)))return false;
    if(!header){
      if(type!=='IHDR'||length!==13)return false;
      const width=bytes.readUInt32BE(offset+8),height=bytes.readUInt32BE(offset+12),depth=bytes[offset+16],color=bytes[offset+17];
      const depths:Record<number,number[]>={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
      if(!width||!height||!depths[color]?.includes(depth)||bytes[offset+18]!==0||bytes[offset+19]!==0||bytes[offset+20]>1)return false;
      header=true;
    }else if(type==='IHDR')return false;
    if(type==='IDAT')data=data||length>0;
    if(type==='IEND')return length===0&&data&&end===bytes.length;
    offset=end;
  }
  return false;
}
function jpeg(bytes:Buffer){
  if(bytes.length<20||bytes[0]!==0xff||bytes[1]!==0xd8)return false;
  let offset=2,frame=false,scan=false;
  while(offset<bytes.length){
    if(bytes[offset++]!==0xff)return false;
    while(bytes[offset]===0xff)offset++;
    const marker=bytes[offset++];
    if(marker===0xd9)return frame&&scan&&offset===bytes.length;
    if(marker===undefined||marker===0||marker===0xd8||marker>=0xd0&&marker<=0xd7||offset+2>bytes.length)return false;
    const length=bytes.readUInt16BE(offset),end=offset+length;
    if(length<2||end>bytes.length)return false;
    if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker)){
      if(length<8||bytes.readUInt16BE(offset+3)===0||bytes.readUInt16BE(offset+5)===0||!bytes[offset+7]||length!==8+3*bytes[offset+7])return false;
      frame=true;
    }
    offset=end;
    if(marker===0xda){
      if(!frame||length<6||!bytes[end-length+2]||length!==6+2*bytes[end-length+2])return false;
      const start=offset;
      while(offset<bytes.length){
        if(bytes[offset]!==0xff){offset++;continue;}
        const next=bytes[offset+1];
        if(next===0||next>=0xd0&&next<=0xd7){offset+=2;continue;}
        break;
      }
      if(offset===start)return false;
      scan=true;
    }
  }
  return false;
}
export function validKycImage(bytes:Buffer,mimeType:string){
  return mimeType==='image/png'?png(bytes):mimeType==='image/jpeg'?jpeg(bytes):false;
}
