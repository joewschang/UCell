import {useEffect,useState} from 'react';
import QRCode from 'qrcode';
export function EventCheckInQr({token,eventCode}:{token:string;eventCode:string}){
 const [image,setImage]=useState(''),[failed,setFailed]=useState(false);
 useEffect(()=>{let active=true;setImage('');setFailed(false);QRCode.toDataURL('ucell:event:'+eventCode+':'+token,{width:360,margin:4,errorCorrectionLevel:'M'}).then(value=>{if(active)setImage(value);}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[token,eventCode]);
 return <div style={{textAlign:'center'}}>{image?<img src={image} alt="活動報到 QR 碼" style={{width:360,maxWidth:'100%',background:'#fff',borderRadius:12}}/>:<p role="status">{failed?'QR 碼 暫時無法顯示，請出示下方憑證或請工作人員以會員編號報到。':'正在產生報到 QR 碼…'}</p>}<p>到場時出示此碼，請勿公開分享。若工作人員已完成掃描，重新開啟活動即可查看報到狀態。</p><details><summary>顯示文字憑證（掃碼失敗時使用）</summary><output aria-label="報到憑證" style={{display:'block',overflowWrap:'anywhere'}}>{token}</output></details></div>;
}
