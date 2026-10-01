import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const evidence=JSON.parse(readFileSync(new URL('./stage-migration-eol-evidence.json',import.meta.url),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
/** Accept byte-identical scripts or specifically recovered, SQL-identical historical EOL forms. */
export function migrationChecksumMatches(name,text,checksum){
 const lf=text.replace(/\r\n/g,'\n');
 if([text,lf,lf.replace(/\n/g,'\r\n')].some(value=>hash(value)===checksum))return true;
 return evidence.rows.some(row=>row.migration===name&&row.legacyChecksum===checksum&&row.normalizedSha256===hash(lf));
}
