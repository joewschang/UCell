import { createHmac } from 'node:crypto';
export type GeoArea = { countryCode: string; level: 'CITY' | 'DISTRICT'; areaCode: string; parentAreaCode: string | null; name: string; aliases?: string[] };
export type NormalizedGeo = { countryCode: string; cityCode: string | null; districtCode: string | null; status: 'NORMALIZED' | 'PARTIAL' | 'FAILED'; reason: string | null; addressHash: string; catalogVersion: string };
/** Inject the versioned official area catalog; never infer district from postal code. */
export function normalizeTaiwanAddress(raw: string, countryCode: string, catalog: GeoArea[], catalogVersion: string, hashKey: string): NormalizedGeo {
  if (!catalogVersion || hashKey.length < 32) throw new Error('GEO_NORMALIZATION_CONFIG_REQUIRED');
  const text = raw.normalize('NFKC').replace(/\s+/g, '').replaceAll('台', '臺').replace(/^\d{3}(?:\d{2,3})?/, '').replace(/^(中華民國|臺灣省|臺灣)/, '');
  const addressHash = createHmac('sha256', hashKey).update(JSON.stringify([countryCode, text])).digest('hex');
  const result = (status: NormalizedGeo['status'], reason: string | null, cityCode: string | null = null, districtCode: string | null = null): NormalizedGeo => ({ countryCode, cityCode, districtCode, status, reason, addressHash, catalogVersion });
  if (!text) return result('FAILED', 'EMPTY_ADDRESS');
  if (countryCode !== 'TW') return result('PARTIAL', 'COUNTRY_NOT_SUPPORTED');
  const names = (a: GeoArea) => [a.name, ...(a.aliases ?? [])].map(n => n.normalize('NFKC').replaceAll('台', '臺'));
  const cities = catalog.filter(a => a.countryCode === 'TW' && a.level === 'CITY' && names(a).some(n => text.startsWith(n)));
  if (cities.length !== 1) return result('FAILED', cities.length ? 'AMBIGUOUS_CITY' : 'CITY_NOT_FOUND');
  const city = cities[0], cityName = names(city).filter(n => text.startsWith(n)).sort((a,b) => b.length-a.length)[0];
  const rest = text.slice(cityName.length);
  const districts = catalog.filter(a => a.countryCode === 'TW' && a.level === 'DISTRICT' && a.parentAreaCode === city.areaCode && names(a).some(n => rest.startsWith(n)));
  if (districts.length !== 1) return result('PARTIAL', districts.length ? 'AMBIGUOUS_DISTRICT' : 'DISTRICT_NOT_FOUND', city.areaCode);
  return result('NORMALIZED', null, city.areaCode, districts[0].areaCode);
}
