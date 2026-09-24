import { Transform, type Readable } from 'node:stream';

/** Tee raw webhook bytes without consuming or reserializing Fastify's parser stream. */
export function captureLineWebhookRawBody(request:{rawBody?:Buffer},payload:Readable){
  const chunks:Buffer[]=[];
  const tee=new Transform({transform(chunk:Buffer,_encoding,callback){chunks.push(Buffer.from(chunk));callback(null,chunk);}});
  tee.on('end',()=>{request.rawBody=Buffer.concat(chunks);});
  payload.pipe(tee);
  return tee;
}
