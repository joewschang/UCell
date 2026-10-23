export function parseEventQr(value:string,eventCode:string){
 const text=value.trim();
 if(/^[A-Za-z0-9_-]{43}$/.test(text))return text;
 const match=/^ucell:event:([A-Z][A-Z0-9_-]{2,39}):([A-Za-z0-9_-]{43})$/.exec(text);
 if(!match)throw new Error('這不是活動報到 QR 碼，請出示會員活動頁的私人報到碼。');
 if(match[1]!==eventCode)throw new Error('這是其他活動的報到碼，請切換至對應活動。');
 return match[2];
}
const messages:Record<string,string>={
 EVENT_CHECKIN_NOT_FOUND:'找不到此報到憑證，請會員重新取得 QR 碼。',
 EVENT_CHECKIN_WRONG_EVENT:'此憑證屬於其他活動，請切換至對應活動。',
 EVENT_CREDENTIAL_REPLACED_OR_CLOSED:'憑證已更新或失效，請會員出示最新 QR 碼。',
 EVENT_NOT_OPEN:'活動尚未發布或已封存，目前不能報到。',
 EVENT_CHECKIN_OUTSIDE_WINDOW:'目前不在活動報到期間，請確認活動開始及結束時間（臺北時間）。',
 EVENT_CAPACITY_FULL:'活動名額已滿，無法補報名。',
 EVENT_MEMBER_NOT_FOUND:'找不到此會員編號，請確認輸入的 10 位數字。',
 EVENT_MEMBER_NOT_ELIGIBLE:'此會員目前不符合活動報名資格。',
 EVENT_REGISTRATION_REQUIRED:'此會員尚未報名，請使用會員編號查詢後補報名並報到。',
 EVENT_REGISTRATION_NOT_CHECKINABLE:'此報名已取消或不在可報到狀態，請重新查詢名冊。',
 EVENT_MEMBER_NUMBER_INVALID:'請輸入正確的 10 位會員編號。',
 EVENT_MANUAL_CHECKIN_INVALID:'請確認會員編號及補報名原因。',
};
export function checkInError(error:unknown){const e=error as {body?:{code?:string;message?:string};message?:string};return messages[e?.body?.message??'']??messages[e?.body?.code??'']??(error instanceof Error?error.message:'報到失敗，請重試。');}
