export function parseKycScanTags(xml:string){
 if(xml.length>32768)return null;
 const tags=new Map<string,string>();for(const match of xml.matchAll(/<Tag>\s*<Key>([^<]*)<\/Key>\s*<Value>([^<]*)<\/Value>\s*<\/Tag>/g)){if(tags.has(match[1].toLowerCase()))return null;tags.set(match[1].toLowerCase(),match[2]);}
 const result=tags.get('malware scanning scan result'),time=tags.get('malware scanning scan time utc');
 if(!time||!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(time)||!Number.isFinite(Date.parse(time.replace(' ','T'))))return null;
 const statuses:Record<string,'CLEAN'|'INFECTED'|'FAILED'>={'No threats found':'CLEAN',Malicious:'INFECTED',Error:'FAILED','Not scanned':'FAILED'};
 const status=result?statuses[result]:undefined;
 return status?{status,scannedAt:new Date(time.replace(' ','T'))}:null;
}
