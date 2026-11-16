// Child-process fixture: all responses synthetic, no real HTTP or credentials.
import {runJournal} from '../retry-journal.mjs';
import {createHash} from 'node:crypto';
import {NOW, TOKEN, payload} from './fixtures.mjs';
const directory = process.argv[2], phase = process.argv[3];
const stop = async detail => { process.send(detail); await new Promise(() => { setInterval(() => {}, 1000); }); };
await runJournal({directory,date:payload.date,now:()=>NOW,
  tokenProvider:async()=>{if(phase==='before-send')await stop({phase});return TOKEN;},
  transport:async(_url,opts)=>{await stop({phase:'accepted-not-recorded',key:opts.headers['Idempotency-Key'],digest:createHash('sha256').update(opts.body).digest('hex')});},
});
