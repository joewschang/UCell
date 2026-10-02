import {communicationAddressFingerprint,GEO_AREAS,normalizeCommunicationAddress} from '../src/modules/organization-geo/geo-normalization';

describe('Geo communication-address classification',()=>{
 it('pins complete government city/district coverage without duplicate codes',()=>{
  expect(GEO_AREAS.filter(a=>a.level==='CITY')).toHaveLength(22);
  expect(GEO_AREAS.filter(a=>a.level==='DISTRICT')).toHaveLength(368);
  expect(new Set(GEO_AREAS.map(a=>a.code)).size).toBe(GEO_AREAS.length);
  for(const district of GEO_AREAS.filter(a=>a.level==='DISTRICT'))expect(GEO_AREAS.some(a=>a.level==='CITY'&&a.code===district.parentCode)).toBe(true);
 });
 it.each(['台北市大安區和平東路100號','１０６ 台北市 大安區 和平東路100號','臺灣臺北市大安區和平東路100號'])('classifies Taiwan formats without leaking street details: %s',address=>{
  const result=normalizeCommunicationAddress(address);
  expect(result).toMatchObject({status:'NORMALIZED',cityCode:'63000',districtCode:'63000030',regionGroup:'NORTH'});
  expect(JSON.stringify(result)).not.toContain('和平');
 });
 it('keeps same-name districts tied to their city',()=>{
  const taipei=normalizeCommunicationAddress('臺北市中正區某路');
  const keelung=normalizeCommunicationAddress('基隆市中正區某路');
  expect(taipei.districtCode).not.toBe(keelung.districtCode);
  expect(normalizeCommunicationAddress('中正區某路').reason).toBe('CITY_NOT_IDENTIFIED');
 });
 it('does not silently discard blank, partial, invalid and overseas populations',()=>{
  expect(normalizeCommunicationAddress('').reason).toBe('ADDRESS_MISSING');
  expect(normalizeCommunicationAddress('臺北市').status).toBe('PARTIAL');
  expect(normalizeCommunicationAddress('臺北市不存在區').districtCode).toBeNull();
  expect(normalizeCommunicationAddress('Tokyo','JP').reason).toBe('OVERSEAS_ADDRESS');
  expect(normalizeCommunicationAddress('a'.repeat(1001)).status).toBe('FAILED');
 });
 it('HMAC changes with address/country/key and rejects absent key material',()=>{
  const key='a'.repeat(48),hash=communicationAddressFingerprint('臺北市','TW',key);
  expect(communicationAddressFingerprint('臺北市','tw',key)).toBe(hash);
  expect(communicationAddressFingerprint('臺南市','TW',key)).not.toBe(hash);
  expect(communicationAddressFingerprint('臺北市','JP',key)).not.toBe(hash);
  expect(communicationAddressFingerprint('臺北市','TW','b'.repeat(48))).not.toBe(hash);
  expect(()=>communicationAddressFingerprint('臺北市','TW','')).toThrow('GEO_ADDRESS_HMAC_SECRET_REQUIRED');
 });
});
