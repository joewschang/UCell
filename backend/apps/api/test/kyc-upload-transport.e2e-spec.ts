import {FastifyAdapter} from '@nestjs/platform-fastify';
import {configureKycUploadTransport,KYC_UPLOAD_BODY_LIMIT} from '../src/modules/member/kyc-upload-transport';
describe('KYC upload request size',()=>{
 it('accepts a normal phone photo payload only on KYC and retains default limits elsewhere',async()=>{
 const server=new FastifyAdapter().getInstance();configureKycUploadTransport(server);
 server.post('/api/v1/member/formal-applications/:id/documents',async()=>({ok:true}));
 server.post('/api/v1/admin/formal-member-applications/:id/paper-scan',async()=>({ok:true}));
 server.post('/api/v1/other',async()=>({ok:true}));
 try{const payload={contentBase64:'A'.repeat(2*1024*1024)};
 expect((await server.inject({method:'POST',url:'/api/v1/member/formal-applications/example/documents',payload})).statusCode).toBe(200);
 expect((await server.inject({method:'POST',url:'/api/v1/admin/formal-member-applications/example/paper-scan',payload})).statusCode).toBe(200);
 expect((await server.inject({method:'POST',url:'/api/v1/other',payload})).statusCode).toBe(413);
 expect((await server.inject({method:'POST',url:'/api/v1/member/formal-applications/example/documents',payload:{contentBase64:'A'.repeat(KYC_UPLOAD_BODY_LIMIT)}})).statusCode).toBe(413);
 }finally{await server.close();}
 });
});
