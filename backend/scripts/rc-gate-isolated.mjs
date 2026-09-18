import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import net from 'node:net';
const require=createRequire(new URL('../packages/database/package.json',import.meta.url));

const base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:55432/postgres');
assert.ok(['127.0.0.1','localhost'].includes(base.hostname),'Local PostgreSQL only');
// The unchanged legacy RC script uses port 3000. Never let it validate another running API.
await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(3000,'127.0.0.1',()=>s.close(resolve));});
const database='ucell_rc_'+randomUUID().replaceAll('-',''),control=new URL(base),target=new URL(base);
control.pathname='/postgres';target.pathname='/'+database;
function controlSql(sql){
 const script="const {PrismaClient}=require(process.argv[1]);const db=new PrismaClient({datasources:{db:{url:process.env.RC_CONTROL_URL}}});(async()=>{try{await db.$executeRawUnsafe(process.argv[2]);}finally{await db.$disconnect();}})().catch(e=>{console.error(e.name);process.exitCode=1;});";
 const child=spawnSync(process.execPath,['-e',script,require.resolve('@prisma/client'),sql],{env:{...process.env,RC_CONTROL_URL:control.href},stdio:'inherit'});
 assert.equal(child.status,0,'ISOLATED_DATABASE_CONTROL_FAILED');
}
let created=false;
try{
 controlSql('CREATE DATABASE "'+database+'"');created=true;
 const env={...process.env,DATABASE_URL:target.href,NODE_ENV:'development',ADMIN_AUTH_BYPASS:'false',SWAGGER_ENABLED:'false'};
 const r=spawnSync(process.execPath,['scripts/run-bash-gate.mjs','rc-gate.sh'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env,stdio:'inherit'});
 if(r.error)throw r.error;assert.equal(r.status,0,'RC_GATE_FAILED');console.log('RC_ISOLATED_PASS');
}finally{
 if(created){controlSql('DROP DATABASE "'+database+'" WITH (FORCE)');console.log('RC_ISOLATED_CLEANUP_PASS');}

}
