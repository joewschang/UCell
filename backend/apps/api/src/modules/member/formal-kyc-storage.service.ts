import {Injectable,ServiceUnavailableException} from '@nestjs/common';

@Injectable()
export class FormalKycStorageService{
  private cfg(){
    const account=process.env.KYC_STORAGE_ACCOUNT_NAME;
    const container=process.env.KYC_STORAGE_CONTAINER;
    const clientId=process.env.KYC_STORAGE_MANAGED_IDENTITY_CLIENT_ID;
    const endpoint=process.env.IDENTITY_ENDPOINT;
    const identityHeader=process.env.IDENTITY_HEADER;
    if(!account||!container||!clientId||!endpoint||!identityHeader)throw new ServiceUnavailableException({code:'KYC_STORAGE_CONFIGURATION_PENDING'});
    return {account,container,clientId,endpoint,identityHeader};
  }
  private async accessToken(){
    const c=this.cfg(),url=new URL(c.endpoint);
    url.searchParams.set('resource','https://storage.azure.com/');
    url.searchParams.set('api-version','2019-08-01');
    url.searchParams.set('client_id',c.clientId);
    const response=await fetch(url,{headers:{'X-IDENTITY-HEADER':c.identityHeader}});
    const body=await response.json() as {access_token?:unknown};
    if(!response.ok||typeof body.access_token!=='string'||!body.access_token)throw new ServiceUnavailableException({code:'KYC_STORAGE_TOKEN_FAILED'});
    return body.access_token;
  }
  private url(objectKey:string){
    const c=this.cfg();
    return 'https://'+c.account+'.blob.core.windows.net/'+encodeURIComponent(c.container)+'/'+objectKey.split('/').map(encodeURIComponent).join('/');
  }
  async put(objectKey:string,bytes:Buffer,mimeType:string){
    const response=await fetch(this.url(objectKey),{
      method:'PUT',
      headers:{Authorization:'Bearer '+await this.accessToken(),'x-ms-version':'2023-11-03','x-ms-date':new Date().toUTCString(),'x-ms-blob-type':'BlockBlob','Content-Type':mimeType},
      body:bytes,
    });
    if(!response.ok)throw new ServiceUnavailableException({code:'KYC_STORAGE_WRITE_FAILED'});
  }
  async get(objectKey:string){
    const response=await fetch(this.url(objectKey),{headers:{Authorization:'Bearer '+await this.accessToken(),'x-ms-version':'2023-11-03','x-ms-date':new Date().toUTCString()}});
    if(!response.ok)throw new ServiceUnavailableException({code:'KYC_STORAGE_READ_FAILED'});
    return {bytes:Buffer.from(await response.arrayBuffer()),mimeType:response.headers.get('content-type')??'application/octet-stream'};
  }
}
