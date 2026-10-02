/** Reserve a window during the click; the authenticated download may finish later. */
export async function openPrivateDocument(download:()=>Promise<Blob>){
 const popup=window.open('about:blank','_blank');
 if(!popup)throw new Error('瀏覽器阻擋文件檢視視窗');
 let objectUrl:string|undefined;
 try{
  popup.opener=null;
  const blob=await download();
  if(popup.closed)throw new Error('文件檢視視窗已關閉');
  if(!['image/png','image/jpeg'].includes(blob.type))throw new Error('文件格式不支援檢視');
  objectUrl=URL.createObjectURL(blob);
  popup.location.replace(objectUrl);
  const completedUrl=objectUrl;
  setTimeout(()=>URL.revokeObjectURL(completedUrl),60_000);
 }catch(error){
  if(objectUrl)URL.revokeObjectURL(objectUrl);
  popup.close();
  throw error;
 }
}
