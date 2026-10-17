import {uiText,domainLabel} from "../../../../shared/design-system/i18n";
import {AdminTable} from '../../components/AdminTable';
import {useState} from 'react';
import {command,get,qs} from '../../lib/api';
import {Card,ErrorBox,Field,PageHeader,Badge} from '../../components/ui';
import {dateTime} from '../../lib/format';

export function DocumentsPage(){
  const [entityType,setEntityType]=useState('MEMBERSHIP_APPLICATION');
  const [entityId,setEntityId]=useState('');
  const [documentType,setDocumentType]=useState('APPLICATION_FORM');
  const [fileName,setFileName]=useState('');
  const [mimeType,setMimeType]=useState('application/pdf');
  const [sizeBytes,setSizeBytes]=useState('');
  const [sha256,setSha256]=useState('');
  const [storageProvider,setStorageProvider]=useState('GOOGLE_DRIVE');
  const [objectKey,setObjectKey]=useState('');
  const [supersedesId,setSupersedesId]=useState('');
  const [rows,setRows]=useState<any[]>([]);
  const [error,setError]=useState<unknown>(null);
  const [busy,setBusy]=useState(false);

  async function load(){
    setError(null);
    try{
      const r:any=await get('/admin/ops-ready/attachments'+qs({entityType,entityId}));
      setRows(r.data??[]);
    }catch(e){setError(e)}
  }
  async function save(){
    setBusy(true);setError(null);
    try{
      await command('/admin/ops-ready/attachments',{
        entityType,entityId,documentType,originalFileName:fileName,mimeType,
        sizeBytes,sha256,storageProvider,objectKey,
        supersedesId:supersedesId||undefined
      });
      await load();
      setFileName('');setSizeBytes('');setSha256('');setObjectKey('');setSupersedesId('');
    }catch(e){setError(e)}finally{setBusy(false)}
  }

  return <><PageHeader title="文件／附件" subtitle={uiText("原始申請書、訂購單、轉讓／退出文件以不可刪除的Metadata與SHA-256追蹤；舊版本只能Supersede。")}/>
    <div className="callout info"><strong>儲存邊界：</strong>{uiText("此版本登錄外部儲存位置與雜湊，不把二進位檔塞進UCell核心資料庫。可使用Google Drive／物件儲存；未來可替換為Azure Blob而不影響制度資料。")}</div>
    <ErrorBox error={error}/>
    <div className="grid two">
      <Card title={uiText("Entity")}><div className="form">
        <Field label={uiText("Entity Type")}><select value={entityType} onChange={e=>setEntityType(e.target.value)}><option value={"MEMBERSHIP_APPLICATION"}>{uiText("MEMBERSHIP_APPLICATION")}</option><option value={"ORDER"}>{uiText("ORDER")}</option><option value={"QUALIFICATION_WORKFLOW"}>{uiText("QUALIFICATION_WORKFLOW")}</option><option value={"RETURN_CASE"}>{uiText("RETURN_CASE")}</option><option value={"PAYOUT_BATCH"}>{uiText("PAYOUT_BATCH")}</option></select></Field>
        <Field label={uiText("Entity ID")}><input value={entityId} onChange={e=>setEntityId(e.target.value)} placeholder={uiText("UUID")}/></Field>
        <button disabled={!entityId} onClick={load}>查詢附件</button>
      </div></Card>
      <Card title="登錄文件"><div className="form">
        <Field label={uiText("Document Type")}><input value={documentType} onChange={e=>setDocumentType(e.target.value)}/></Field>
        <Field label={uiText("Original File Name")}><input value={fileName} onChange={e=>setFileName(e.target.value)}/></Field>
        <Field label={uiText("MIME Type")}><input value={mimeType} onChange={e=>setMimeType(e.target.value)}/></Field>
        <Field label={uiText("Size Bytes")}><input value={sizeBytes} onChange={e=>setSizeBytes(e.target.value)}/></Field>
        <Field label={uiText("SHA-256")}><input value={sha256} onChange={e=>setSha256(e.target.value)} placeholder={uiText("64 hex chars")}/></Field>
        <Field label={uiText("Storage Provider")}><select value={storageProvider} onChange={e=>setStorageProvider(e.target.value)}><option value={"GOOGLE_DRIVE"}>{uiText("GOOGLE_DRIVE")}</option><option value={"AZURE_BLOB"}>{uiText("AZURE_BLOB")}</option><option value={"S3_COMPATIBLE"}>{uiText("S3_COMPATIBLE")}</option><option value={"LOCAL_ARCHIVE"}>{uiText("LOCAL_ARCHIVE")}</option></select></Field>
        <Field label={uiText("Object Key / File ID")}><input value={objectKey} onChange={e=>setObjectKey(e.target.value)}/></Field>
        <Field label={uiText("Supersedes Attachment ID（選填）")}><input value={supersedesId} onChange={e=>setSupersedesId(e.target.value)}/></Field>
        <button className="primary" disabled={busy||!entityId||!fileName||sha256.length!==64||!objectKey} onClick={save}>{uiText("登錄不可變文件Metadata")}</button>
      </div></Card>
    </div>
    <Card title="版本紀錄"><div className="table-wrap"><AdminTable><thead><tr><th>{uiText("Type")}</th><th>{uiText("Version")}</th><th>{uiText("Status")}</th><th>{uiText("File")}</th><th>{uiText("Storage")}</th><th>{uiText("SHA-256")}</th><th>{uiText("Uploaded")}</th></tr></thead><tbody>{rows.map(x=><tr key={x.documentAttachmentId}><td>{x.documentType}</td><td>v{x.versionNo}</td><td><Badge tone={x.status==='ACTIVE'?'ok':'neutral'}>{domainLabel(x.status)}</Badge></td><td>{x.originalFileName}</td><td>{x.storageProvider}<br/><span className="mono">{x.objectKey}</span></td><td className="mono">{x.sha256}</td><td>{dateTime(x.uploadedAt)}</td></tr>)}</tbody></AdminTable></div></Card>
  </>
}
