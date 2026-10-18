/** Base64 expands a 10 MiB image to ~13.34 MiB. Restrict the larger JSON
 * transport allowance to authenticated KYC upload routes; service validation
 * still enforces the original decoded 10 MiB limit and image signatures. */
export const KYC_UPLOAD_BODY_LIMIT=14*1024*1024;
export function configureKycUploadTransport(server:any){
 server.addHook('onRoute',(route:any)=>{
  const methods=Array.isArray(route.method)?route.method:[route.method];
  if(methods.includes('POST')&&(/^\/api\/v1\/member\/formal-applications\/:[^/]+\/documents$/.test(route.url)||/^\/api\/v1\/admin\/formal-member-applications\/:[^/]+\/paper-scan$/.test(route.url)))route.bodyLimit=KYC_UPLOAD_BODY_LIMIT;
 });
}
