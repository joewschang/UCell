const base=process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';

async function get(path){
  const r=await fetch(base+path);
  if(!r.ok) throw new Error(`${path} => ${r.status}`);
  return r.json();
}

const health=await get('/api/v1/health');
if(!health) throw new Error('health response empty');
console.log('HTTP_HEALTH_PASS');
