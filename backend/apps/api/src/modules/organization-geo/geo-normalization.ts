import {createHmac} from 'node:crypto';

export type GeoStatus='PENDING'|'NORMALIZED'|'PARTIAL'|'FAILED'|'MANUAL_CONFIRMED';
export type RegionGroup='NORTH'|'CENTRAL'|'SOUTH'|'EAST'|'ISLAND';
export type GeoArea={code:string;name:string;level:'CITY'|'DISTRICT';parentCode:string|null;countryCode:string;regionGroup:RegionGroup};
const seed: {version:string;areas:GeoArea[]} = require('./taiwan-areas.json');
export const GEO_DEFINITION_VERSION='UCELL_GEO_GPV_V1';
export const GEO_AREA_VERSION=seed.version;
export const GEO_METRICS=['BALLS','MEMBERS','ACTIVE_BALLS','NEW_BALLS','GPV'] as const;
export const GEO_AREAS:readonly GeoArea[]=Object.freeze(seed.areas.map(area=>Object.freeze(area)));
export type NormalizedGeo={status:GeoStatus;reason:string|null;countryCode:string;cityCode:string|null;districtCode:string|null;regionGroup:RegionGroup|null;confidence:number;definitionVersion:string};

/** Administrative classification only. Never retain street/door data in aggregate facts. */
export function normalizeCommunicationAddress(address:unknown,countryCode='TW'):NormalizedGeo {
 const country=countryCode.trim().toUpperCase();
 const base={countryCode:country,cityCode:null,districtCode:null,regionGroup:null,confidence:0,definitionVersion:GEO_AREA_VERSION};
 if(typeof address!=='string'||!address.trim())return {...base,status:'PARTIAL',reason:'ADDRESS_MISSING'};
 if(country!=='TW')return {...base,status:'PARTIAL',reason:'OVERSEAS_ADDRESS'};
 if(address.length>1000)return {...base,status:'FAILED',reason:'ADDRESS_TOO_LONG'};
 const text=address.normalize('NFKC').replace(/台/g,'臺').replace(/\s/g,'')
  .replace(/^(?:(?:臺灣|中華民國)|\d{3}(?:\d{2,3})?)+/,'');
 const cities=GEO_AREAS.filter(a=>a.level==='CITY'&&text.startsWith(a.name));
 if(cities.length!==1)return {...base,status:'PARTIAL',reason:'CITY_NOT_IDENTIFIED'};
 const city=cities[0],rest=text.slice(city.name.length);
 const districts=GEO_AREAS.filter(a=>a.level==='DISTRICT'&&a.parentCode===city.code&&rest.startsWith(a.name));
 const located={...base,cityCode:city.code,regionGroup:city.regionGroup,confidence:0.5};
 if(districts.length!==1)return {...located,status:'PARTIAL',reason:'DISTRICT_NOT_IDENTIFIED'};
 return {...located,districtCode:districts[0].code,confidence:1,status:'NORMALIZED',reason:null};
}

/** Address hashes must resist dictionary enumeration and never use an unkeyed PII digest. */
export function communicationAddressFingerprint(address:string,countryCode:string,secret:string){
 if(secret.length<32)throw new Error('GEO_ADDRESS_HMAC_SECRET_REQUIRED');
 return createHmac('sha256',secret).update(JSON.stringify(['GEO_COMMUNICATION_ADDRESS_V1',countryCode.trim().toUpperCase(),address.normalize('NFKC').trim()])).digest('hex');
}
