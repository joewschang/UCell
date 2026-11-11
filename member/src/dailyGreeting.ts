import {unwrapMemberEnvelope} from './memberApi';

export type DailyGreeting = {
  date: string;
  title: string;
  message: string;
  category: '早安' | '問好' | '祝福' | '提醒' | '節慶';
  imageUrl: string;
  shareUrl: string;
  availableAt: string;
  nextRefreshAt: string;
  timeZone: 'Asia/Taipei';
  renderer: 'template-v1' | 'reviewed-upload-v1';
};

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const invalid = '每日問候資料暫時無法使用，請重新載入。';
class ExpiredDailyGreetingError extends Error {
  constructor() {super('今日問候正在更新，請稍後重新載入。');}
}

function trustedApiBase(pageUrl: string, base: string) {
  const url = new URL(base, pageUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error(invalid);
  return url;
}

/** The API owns the dated public assets. Never open arbitrary URLs from a response. */
export function parseDailyGreeting(value: unknown, pageUrl = window.location.href, base = apiBase, now = Date.now()): DailyGreeting {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(invalid);
  const data = value as Record<string, unknown>;
  if (typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
      !Number.isFinite(Date.parse(data.date)) || new Date(data.date).toISOString().slice(0, 10) !== data.date ||
      typeof data.title !== 'string' || !data.title.trim() || data.title.length > 200 ||
      typeof data.message !== 'string' || !data.message.trim() || data.message.length > 2000 ||
      !['早安', '問好', '祝福', '提醒', '節慶'].includes(String(data.category)) ||
      data.timeZone !== 'Asia/Taipei' || !['template-v1','reviewed-upload-v1'].includes(String(data.renderer)) ||
      typeof data.availableAt !== 'string' || !Number.isFinite(Date.parse(data.availableAt)) ||
      typeof data.nextRefreshAt !== 'string' || !Number.isFinite(Date.parse(data.nextRefreshAt))) throw new Error(invalid);
  if (Date.parse(data.availableAt) > now || Date.parse(data.nextRefreshAt) <= Date.parse(data.availableAt))
    throw new Error('今日問候正在更新，請稍後重新載入。');
  if (Date.parse(data.nextRefreshAt) <= now) throw new ExpiredDailyGreetingError();
  const api = trustedApiBase(pageUrl, base);
  let version=data.date;
  if(data.renderer==='reviewed-upload-v1'){
    const match=typeof data.imageUrl==='string'&&new URL(data.imageUrl,api.origin).pathname.match(/\/publications\/([0-9a-f-]{36})\/([0-9a-f]{64})\/image.png$/);
    if(!match||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(match[1]))throw new Error(invalid);
    version=`publications/${match[1]}/${match[2]}`;
  }
  const prefix = api.pathname.replace(/\/$/, '') + '/public/daily-greetings/' + version;
  function asset(value: unknown, suffix: string) {
    if (typeof value !== 'string') throw new Error(invalid);
    const url = new URL(value, api.origin);
    if (url.origin !== api.origin || url.username || url.password || url.hash || url.search || url.pathname !== prefix + suffix)
      throw new Error(invalid);
    return url.href;
  }
  return {...data, imageUrl: asset(data.imageUrl, '/image.png'), shareUrl: asset(data.shareUrl, '/share')} as DailyGreeting;
}

export async function getDailyGreeting(signal: AbortSignal): Promise<DailyGreeting> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, {once: true});
  if (signal.aborted) controller.abort();
  const timer = setTimeout(abort, 15_000);
  try {
    const base = trustedApiBase(window.location.href, apiBase);
    const url = base.href.replace(/\/$/, '') + '/public/daily-greetings/current';
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(url, {
        signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
        headers: {Accept: 'application/json'},
      });
      if (!response.ok) throw new Error('每日問候暫時無法載入，請稍後重試。');
      try {
        return parseDailyGreeting(unwrapMemberEnvelope(await response.json()));
      } catch (error) {
        // A valid response can cross the daily boundary in transit. Retry once within
        // the same timeout; never expose the expired image or retry future availability.
        if (error instanceof ExpiredDailyGreetingError && attempt === 0 && !controller.signal.aborted) continue;
        throw error;
      }
    }
  } catch (error) {
    if (signal.aborted) throw error;
    if (controller.signal.aborted) throw new Error('每日問候載入逾時，請檢查網路後重試。');
    if (error instanceof TypeError) throw new Error('目前無法連線，請檢查網路後重試每日問候。');
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export function dailyGreetingLineUrl(greeting: DailyGreeting) {
  return 'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(greeting.shareUrl) +
    '&text=' + encodeURIComponent('UCell 每日問候｜' + greeting.title);
}

/** These composers carry a public link, never an uploaded image or a posting token. */
export function dailyGreetingSocialUrl(platform:'facebook'|'threads'|'x',greeting:DailyGreeting){
 const text='UCell 每日問候｜'+greeting.title;
 if(platform==='facebook')return 'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(greeting.shareUrl);
 if(platform==='threads')return 'https://www.threads.net/intent/post?text='+encodeURIComponent(text+'\n'+greeting.shareUrl);
 return 'https://x.com/intent/tweet?text='+encodeURIComponent(text)+'&url='+encodeURIComponent(greeting.shareUrl);
}
