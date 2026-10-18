import {useEffect,useState} from 'react';
import QRCode from 'qrcode';
export function CheckInQr({kind,token}:{kind:'EVENT'|'LEARNING';token:string}){
 const [url,setUrl]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;setUrl('');setError('');QRCode.toDataURL('UCELL:'+kind+':'+token,{width:300,margin:4,errorCorrectionLevel:'M'}).then(value=>{if(active)setUrl(value)}).catch(()=>{if(active)setError('QR Code 產生失敗，請重新取得憑證。')});return()=>{active=false}},[kind,token]);
 return <section aria-label="會員報到 QR Code">{url&&<img src={url} alt="請向工作人員出示此報到 QR Code" style={{width:300,maxWidth:'100%',height:'auto',background:'white'}}/>}{error&&<p role="alert">{error}</p>}<p>請出示此 QR Code 供工作人員掃描，請勿轉傳他人。</p></section>;
}
