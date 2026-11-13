import {useCallback, useEffect, useRef, useState} from 'react';
import GreetingShareIcon from './GreetingShareIcon';
import liff from '@line/liff';
import {getDailyGreeting, type DailyGreeting} from './dailyGreeting';
import './daily-greeting.css';

type GreetingState = {loading: boolean; data?: DailyGreeting; error?: string};

function imagePickerAvailable() {
  try {return liff.isLoggedIn() && liff.isApiAvailable('shareTargetPicker');}
  catch {return false; /* A normal browser may not have an initialized LIFF SDK. */}
}

/** Independent of the other Explore resources and of the current qualification. */
export default function DailyGreetingCard() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<GreetingState>({loading: true});
  const loading = useRef(false);
  const refresh = useCallback(() => {
    if (loading.current) return;
    loading.current = true;
    // Remove yesterday's actionable image immediately, including on visibility resume.
    setState({loading: true});
    setAttempt(value => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loading.current = true;
    setState({loading: true});
    getDailyGreeting(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({loading: false, data});
    }).catch(error => {
      if (!controller.signal.aborted) setState({loading: false, error: error instanceof Error ? error.message : '每日問候暫時無法載入，請稍後重試。'});
    }).finally(() => {if (!controller.signal.aborted) loading.current = false;});
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (!state.data) return;
    const timer = setTimeout(refresh, Math.max(0, Math.min(2_147_483_647, Date.parse(state.data.nextRefreshAt) - Date.now())));
    return () => clearTimeout(timer);
  }, [state.data, refresh]);

  useEffect(() => {
    const resume = () => {if (document.visibilityState === 'visible') refresh();};
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
    };
  }, [refresh]);

  return <section className="card uc-daily-greeting" aria-label="每日問候" aria-busy={state.loading}>
    {state.data ? <GreetingPoster key={attempt} greeting={state.data} refresh={refresh}/> :
      <div className="uc-daily-empty">
        <small className="uc-daily-eyebrow">UCELL · 每日問候</small>
        <h2>把今天的美好，分享出去</h2>
        {state.loading ? <p role="status">正在準備每日問候圖…</p> : <>
          <p role="alert">{state.error}</p>
          <button onClick={refresh}>重新載入每日問候</button>
        </>}
        <p className="uc-daily-note">每日早晨更新，讓關心從一句問候開始。</p>
      </div>}
  </section>;
}

function GreetingPoster({greeting, refresh}: {greeting: DailyGreeting; refresh: () => void}) {
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const flight = useRef(false);
  const alive = useRef(true);
  const download = useRef<AbortController>();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const objectUrls = useRef<string[]>([]);
  const ready = imageState === 'ready' && !busy;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      download.current?.abort();
      timers.current.forEach(clearTimeout);
      objectUrls.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (imageState !== 'loading') return;
    const timer = setTimeout(() => setImageState('failed'), 15_000);
    return () => clearTimeout(timer);
  }, [imageState]);

  function canAct() {
    if (Date.parse(greeting.nextRefreshAt) <= Date.now()) {refresh(); return false;}
    return imageState === 'ready' && !flight.current;
  }
  function finish() {
    flight.current = false;
    if (alive.current) setBusy(null);
  }
  const [file,setFile]=useState<File>();
  useEffect(()=>{
    const controller=new AbortController();
    fetch(greeting.imageUrl,{signal:controller.signal,credentials:'omit'}).then(async r=>{
      if(!r.ok) return;
      const blob=await r.blob();
      if(blob.type==='image/png'&&!controller.signal.aborted)setFile(new File([blob],'UCell-'+greeting.date+'.png',{type:'image/png'}));
    }).catch(()=>{});
    return ()=>controller.abort();
  },[greeting.imageUrl,greeting.date]);
  async function shareImage(platform:string){
    if(!canAct())return;
    flight.current=true;setBusy('share');setError('');setNotice('');
    try{
      if(platform==='LINE'&&imagePickerAvailable())await liff.shareTargetPicker([{type:'image',originalContentUrl:greeting.imageUrl,previewImageUrl:greeting.imageUrl}]);
      else if(file&&navigator.canShare?.({files:[file]}))await navigator.share({files:[file]});
      else setNotice('請先儲存圖片，再從 '+platform+' 選取這張圖分享。');
    }catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setError('圖片分享未完成，可儲存後再分享。');}
    finally{finish();}
  }
  async function saveImage() {
    if (!canAct()) return;
    flight.current = true;
    setBusy('save'); setNotice(''); setError('');
    const controller = new AbortController();
    download.current = controller;
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(greeting.imageUrl, {signal: controller.signal, credentials: 'omit', redirect: 'error'});
      if (!response.ok || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'image/png') throw new Error('Invalid PNG');
      const blob = await response.blob();
      if (!alive.current || controller.signal.aborted) return;
      if (Date.parse(greeting.nextRefreshAt) <= Date.now()) {refresh(); return;}
      if (!blob.size) throw new Error('Empty image');
      const url = URL.createObjectURL(blob);
      objectUrls.current.push(url);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `UCell-每日問候-${greeting.date}.png`;
      document.body.appendChild(anchor);
      try {anchor.click();} finally {anchor.remove();}
      timers.current.push(setTimeout(() => {
        URL.revokeObjectURL(url);
        objectUrls.current = objectUrls.current.filter(value => value !== url);
      }, 60_000));
      setNotice('已送出儲存要求。若未下載，請開啟原圖後長按儲存，或使用瀏覽器的分享選單。');
    } catch {
      if (alive.current) setError('無法自動儲存，請點「開啟原圖」，再長按圖片或使用瀏覽器選單儲存。');
    } finally {
      clearTimeout(timer);
      finish();
    }
  }

  return <div className="uc-daily-layout">
    <div className="uc-daily-art" aria-busy={imageState === 'loading'}>
      {imageState !== 'failed' && <img src={greeting.imageUrl} alt={`${greeting.date} UCell 每日${greeting.category}：${greeting.title}。${greeting.message}`} onLoad={() => setImageState('ready')} onError={() => setImageState('failed')}/>}
      {imageState === 'loading' && <p role="status" className="uc-daily-image-status">問候圖載入中…</p>}
      {imageState === 'failed' && <div className="uc-daily-image-error"><p role="alert">問候圖暫時無法顯示，請重新載入後再分享。</p><button onClick={refresh}>重新載入圖片</button></div>}
    </div>
    <div className="uc-daily-copy">
      <small className="uc-daily-eyebrow">UCELL · 每日問候</small>
      <div className="uc-daily-meta"><time dateTime={greeting.date}>{greeting.date.replaceAll('-', '.')}</time><span>{greeting.category}</span></div>
      <h2>{greeting.title}</h2>
      <p className="uc-daily-message">{greeting.message}</p>
      <div className="uc-daily-actions">
        <button className="uc-share-line" disabled={!ready} onClick={()=>shareImage('LINE')}>分享LINE好友</button>
        <button onClick={() => void saveImage()} disabled={!ready}>{busy === 'save' ? '正在準備圖片…' : '儲存圖片'}</button>
      </div>
      <div className="uc-daily-actions uc-social-logos" role="group" aria-label="其他平台分享">
        {(['facebook','threads','x','instagram'] as const).map(p=><button key={p} disabled={!ready} aria-label={'分享圖片至 '+p} onClick={()=>shareImage(p)}><GreetingShareIcon platform={p}/></button>)}
      </div>
      {imageState === 'ready' && <p className="uc-daily-note"><a href={greeting.imageUrl} target="_blank" rel="noopener noreferrer" aria-disabled={!!busy} onClick={event => {if (!canAct()) event.preventDefault();}}>開啟原圖</a> · 手機或 LINE 內無法下載時，可開啟後長按儲存。</p>}
      {notice && <p role="status" className="uc-daily-feedback">{notice}</p>}
      {error && <p role="alert" className="uc-daily-feedback">{error}</p>}
      <p className="uc-daily-note uc-daily-refresh">每日早晨更新 · 臺北時間</p>
    </div>
  </div>;
}
