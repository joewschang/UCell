import { Readable } from 'node:stream';
import { captureLineWebhookRawBody } from '../src/modules/auth/line-webhook-raw-body';

describe('LINE webhook raw-body capture',()=>{
 it('tees the exact bytes without changing the parser stream',async()=>{
  const request:{rawBody?:Buffer}={},input=Buffer.from('{"events":["✓"]}','utf8');
  const tee=captureLineWebhookRawBody(request,Readable.from([input.subarray(0,6),input.subarray(6)]));
  const forwarded:Buffer[]=[];for await(const chunk of tee)forwarded.push(Buffer.from(chunk));
  expect(Buffer.concat(forwarded)).toEqual(input);
  expect(request.rawBody).toEqual(input);
 });
});
