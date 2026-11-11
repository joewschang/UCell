import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import liff from '@line/liff';
import DailyGreetingCard from '../src/DailyGreetingCard';
import {ExploreHub} from '../src/MemberHubs';
import {dailyGreetingLineUrl, getDailyGreeting, parseDailyGreeting} from '../src/dailyGreeting';

vi.mock('@line/liff', () => ({default: {isLoggedIn: vi.fn(), isApiAvailable: vi.fn(), shareTargetPicker: vi.fn()}}));
const now = '2026-11-11T02:00:00Z';
const data = {
  date: '2026-11-11', title: '早安，讓美好慢慢發生', message: '用一份微笑，迎接今天的每一個可能。', category: '早安',
  imageUrl: '/api/v1/public/daily-greetings/2026-11-11/image.png',
  shareUrl: '/api/v1/public/daily-greetings/2026-11-11/share',
  availableAt: '2026-11-10T23:00:00Z', nextRefreshAt: '2026-11-11T23:00:00Z', timeZone: 'Asia/Taipei', renderer: 'template-v1',
};
const envelope = (value: unknown = data, status = 200) => new Response(JSON.stringify({data: value, meta: {request_id: 'daily-test', api_version: 'v1', timestamp: now}}), {status});
let tree: ReactTestRenderer | undefined;
let documentMock: EventTarget & {visibilityState: string; createElement: ReturnType<typeof vi.fn>; body: {appendChild: ReturnType<typeof vi.fn>}};
let windowMock: EventTarget & {location: {href: string}};
let anchor: {href: string; download: string; click: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>};

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(now));
  anchor = {href: '', download: '', click: vi.fn(), remove: vi.fn()};
  documentMock = Object.assign(new EventTarget(), {visibilityState: 'visible', createElement: vi.fn(() => anchor), body: {appendChild: vi.fn()}});
  windowMock = Object.assign(new EventTarget(), {location: {href: 'https://member.ucell.test/explore'}});
  vi.stubGlobal('document', documentMock); vi.stubGlobal('window', windowMock);
  vi.mocked(liff.isLoggedIn).mockReturnValue(false); vi.mocked(liff.isApiAvailable).mockReturnValue(false);
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(envelope())));
});
afterEach(() => {
  act(() => tree?.unmount()); tree = undefined;
  vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.useRealTimers();
});
const output = () => JSON.stringify(tree?.toJSON());
const line = () => tree!.root.findByProps({className: 'uc-daily-line'});
const save = () => tree!.root.findAllByType('button').find(button => button.children.join('').includes('圖片') && !button.children.join('').includes('重新'))!;
async function renderReady() {
  await act(async () => {tree = create(<DailyGreetingCard/>);});
  act(() => tree!.root.findByType('img').props.onLoad());
}

it('validates the current envelope and makes only a public, uncached read without member credentials', async () => {
  const greeting = await getDailyGreeting(new AbortController().signal);
  expect(greeting.imageUrl).toBe('https://member.ucell.test' + data.imageUrl);
  expect(fetch).toHaveBeenCalledWith('https://member.ucell.test/api/v1/public/daily-greetings/current', expect.objectContaining({credentials: 'omit', cache: 'no-store', redirect: 'error', headers: {Accept: 'application/json'}}));
  expect(new URL(dailyGreetingLineUrl(greeting)).searchParams.get('url')).toBe(greeting.shareUrl);
});

it('allows the configured external API origin while rejecting arbitrary assets, credentials and invalid dates', () => {
  const base = 'https://api.ucell.life/api/v1';
  const absolute = {...data, imageUrl: 'https://api.ucell.life' + data.imageUrl, shareUrl: 'https://api.ucell.life' + data.shareUrl};
  expect(parseDailyGreeting(absolute, windowMock.location.href, base).imageUrl).toBe(absolute.imageUrl);
  for (const imageUrl of ['javascript:alert(1)', 'https://evil.invalid' + data.imageUrl, 'https://api.ucell.life.evil.invalid' + data.imageUrl, 'https://user:pass@api.ucell.life' + data.imageUrl, absolute.imageUrl + '?token=secret', absolute.imageUrl + '#test', 'https://api.ucell.life/api/v1/public/daily-greetings/2026-11-10/image.png', 'http://api.ucell.life' + data.imageUrl])
    expect(() => parseDailyGreeting({...absolute, imageUrl}, windowMock.location.href, base)).toThrow();
  for (const overrides of [{date: '2026-02-30'}, {shareUrl: 'https://evil.invalid/share'}, {category: 'other'}, {nextRefreshAt: now}, {availableAt: '2099-01-01T00:00:00Z'}, {timeZone: 'UTC'}, {title: ''}, {renderer: 'unknown'}])
    expect(() => parseDailyGreeting({...absolute, ...overrides}, windowMock.location.href, base)).toThrow();
});

it('keeps the Explore destinations available during greeting failure and supports a bounded retry', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(envelope(null, 503));
  await act(async () => {tree = create(<MemoryRouter><ExploreHub/></MemoryRouter>);});
  expect(output()).toContain('每日問候暫時無法載入');
  expect(tree!.root.findAllByType('a').map(link => link.props.href)).toEqual(['/content', '/events', '/learning']);
  await act(async () => tree!.root.findByProps({children: '重新載入每日問候'}).props.onClick());
  expect(tree!.root.findByType('img').props.src).toContain(data.date);
  expect(output().indexOf('uc-daily-greeting')).toBeLessThan(output().indexOf('uc-hub-grid'));
});

it('disables sharing and saving until the poster loads, and keeps failed images unshareable', async () => {
  await act(async () => {tree = create(<DailyGreetingCard/>);});
  expect(save().props.disabled).toBe(true); expect(line().props.href).toBeUndefined();
  act(() => tree!.root.findByType('img').props.onError());
  expect(tree!.root.findAllByType('img')).toHaveLength(0); expect(line().props.href).toBeUndefined();
  expect(save().props.disabled).toBe(true);
  await act(async () => tree!.root.findByProps({children: '重新載入圖片'}).props.onClick());
  act(() => tree!.root.findByType('img').props.onLoad());
  expect(save().props.disabled).toBe(false); expect(line().props.href).toContain('social-plugins.line.me');
});

it('offers a synchronous, explicit LINE link fallback rather than an async popup or a false success', async () => {
  await renderReady();
  expect(line().children).toEqual(['LINE 連結分享']);
  const event = {preventDefault: vi.fn()};
  act(() => line().props.onClick(event));
  expect(event.preventDefault).not.toHaveBeenCalled(); expect(liff.shareTargetPicker).not.toHaveBeenCalled();
  // React flushes state updates before the default browser navigation. Keep its href intact.
  expect(line().props.href).toContain('social-plugins.line.me');
  expect(output()).toContain('請在 LINE 選擇分享對象並確認送出'); expect(output()).not.toContain('已透過 LINE 分享圖片');
  const repeated = {preventDefault: vi.fn()};
  act(() => line().props.onClick(repeated));
  expect(repeated.preventDefault).toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1000));
  expect(line().props['aria-disabled']).toBe(false);
});

it('sends only the selected public PNG through LIFF, prevents repeated clicks, and treats cancellation as unsent', async () => {
  vi.mocked(liff.isLoggedIn).mockReturnValue(true); vi.mocked(liff.isApiAvailable).mockReturnValue(true);
  let finish!: (value: undefined) => void;
  vi.mocked(liff.shareTargetPicker).mockImplementation(() => new Promise(resolve => {finish = resolve;}));
  await renderReady();
  const event = {preventDefault: vi.fn()};
  act(() => {line().props.onClick(event); line().props.onClick(event);});
  expect(liff.shareTargetPicker).toHaveBeenCalledTimes(1);
  const url = 'https://member.ucell.test' + data.imageUrl;
  expect(liff.shareTargetPicker).toHaveBeenCalledWith([{type: 'image', originalContentUrl: url, previewImageUrl: url}]);
  await act(async () => finish(undefined));
  expect(output()).toContain('已取消分享，尚未送出圖片'); expect(output()).not.toContain('已透過 LINE 分享圖片');
  expect(save().props.disabled).toBe(false);
});

it('reports LIFF success only for a success result and exposes a new link click after SDK rejection', async () => {
  vi.mocked(liff.isLoggedIn).mockReturnValue(true); vi.mocked(liff.isApiAvailable).mockReturnValue(true);
  vi.mocked(liff.shareTargetPicker).mockResolvedValueOnce({status: 'success'}).mockRejectedValueOnce(new Error('not available'));
  await renderReady();
  await act(async () => line().props.onClick({preventDefault: vi.fn()}));
  expect(output()).toContain('已透過 LINE 分享圖片');
  await act(async () => line().props.onClick({preventDefault: vi.fn()}));
  expect(line().children).toEqual(['LINE 連結分享']);
  const event = {preventDefault: vi.fn()};
  act(() => line().props.onClick(event));
  expect(event.preventDefault).not.toHaveBeenCalled(); expect(liff.shareTargetPicker).toHaveBeenCalledTimes(2);
});

it('downloads a PNG blob once with a dated filename and retains an iOS open-original fallback', async () => {
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:daily-test');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  await renderReady();
  let resolve!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(done => {resolve = done;}));
  act(() => {save().props.onClick(); save().props.onClick();});
  expect(fetch).toHaveBeenCalledTimes(2);
  await act(async () => resolve(new Response(new Blob(['PNG'], {type: 'image/png'}), {headers: {'content-type': 'image/png'}})));
  expect(createUrl).toHaveBeenCalledTimes(1); expect(anchor.click).toHaveBeenCalledTimes(1);
  expect(anchor.download).toBe('UCell-每日問候-2026-11-11.png'); expect(anchor.remove).toHaveBeenCalled();
  expect(tree!.root.findByProps({children: '開啟原圖'}).props.href).toBe('https://member.ucell.test' + data.imageUrl);
  expect(output()).toContain('長按儲存'); expect(output()).toContain('已送出儲存要求');
  act(() => vi.advanceTimersByTime(60_000)); expect(revoke).toHaveBeenCalledWith('blob:daily-test');
});

it('never downloads an HTML error response as a PNG and offers manual saving without a delayed popup', async () => {
  await renderReady();
  vi.mocked(fetch).mockResolvedValueOnce(new Response('<html>Error</html>', {headers: {'content-type': 'text/html'}}));
  await act(async () => save().props.onClick());
  expect(anchor.click).not.toHaveBeenCalled(); expect(output()).toContain('無法自動儲存');
  expect(save().props.disabled).toBe(false);
});

it('refreshes at the server boundary and on visibility resume, clearing the old image during each request', async () => {
  const boundary = '2026-11-11T02:00:01Z';
  vi.mocked(fetch).mockResolvedValueOnce(envelope({...data, nextRefreshAt: boundary}));
  await renderReady();
  let resolve!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(done => {resolve = done;}));
  act(() => vi.advanceTimersByTime(1000));
  expect(tree!.root.findAllByType('img')).toHaveLength(0); expect(output()).toContain('正在準備每日問候圖');
  await act(async () => resolve(envelope()));
  expect(tree!.root.findByType('img').props.src).toContain(data.date);
  documentMock.visibilityState = 'hidden'; act(() => documentMock.dispatchEvent(new Event('visibilitychange')));
  expect(fetch).toHaveBeenCalledTimes(2);
  documentMock.visibilityState = 'visible';
  await act(async () => documentMock.dispatchEvent(new Event('visibilitychange')));
  expect(fetch).toHaveBeenCalledTimes(3);
  await act(async () => windowMock.dispatchEvent(new Event('pageshow')));
  expect(fetch).toHaveBeenCalledTimes(4);
});

it('blocks stale action handlers even before a delayed background refresh timer has run', async () => {
  await renderReady();
  const handler = line().props.onClick;
  vi.setSystemTime(new Date('2026-11-12T00:00:00Z'));
  const event = {preventDefault: vi.fn()};
  await act(async () => handler(event));
  expect(event.preventDefault).toHaveBeenCalled(); expect(liff.shareTargetPicker).not.toHaveBeenCalled();
  expect(tree!.root.findAllByType('img')).toHaveLength(0);
  expect(output()).toContain('今日問候正在更新');
});

it('aborts an in-flight public load on navigation away and removes resume listeners', async () => {
  let signal!: AbortSignal;
  vi.mocked(fetch).mockImplementation((_url, init) => {signal = init!.signal as AbortSignal; return new Promise(() => {});});
  await act(async () => {tree = create(<DailyGreetingCard/>);});
  act(() => {tree!.unmount(); tree = undefined;});
  expect(signal.aborted).toBe(true);
  documentMock.dispatchEvent(new Event('visibilitychange'));
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('aborts saving on navigation and never starts a late download from the detached card', async () => {
  await renderReady();
  let signal!: AbortSignal, finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce((_url, init) => {signal = init!.signal as AbortSignal; return new Promise(resolve => {finish = resolve;});});
  act(() => save().props.onClick());
  act(() => {tree!.unmount(); tree = undefined;});
  expect(signal.aborted).toBe(true);
  await act(async () => finish(new Response(new Blob(['PNG'], {type: 'image/png'}), {headers: {'content-type': 'image/png'}})));
  expect(anchor.click).not.toHaveBeenCalled();
});

it('times out a hanging image without leaving share actions enabled', async () => {
  await act(async () => {tree = create(<DailyGreetingCard/>);});
  act(() => vi.advanceTimersByTime(15_000));
  expect(tree!.root.findAllByType('img')).toHaveLength(0);
  expect(output()).toContain('問候圖暫時無法顯示');
  expect(line().props.href).toBeUndefined(); expect(save().props.disabled).toBe(true);
});

it('retries metadata once when it expires in transit and keeps the expired image hidden', async () => {
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockResolvedValueOnce(envelope({...data, nextRefreshAt: now}))
    .mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
  await act(async () => {tree = create(<DailyGreetingCard/>);});
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(tree!.root.findAllByType('img')).toHaveLength(0);
  expect(output()).toContain('正在準備每日問候圖');
  await act(async () => finish(envelope()));
  expect(tree!.root.findByType('img').props.src).toBe('https://member.ucell.test' + data.imageUrl);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('bounds expiry retries to one and does not retry future availability or invalid timing', async () => {
  vi.mocked(fetch).mockImplementation(() => Promise.resolve(envelope({...data, nextRefreshAt: now})));
  await expect(getDailyGreeting(new AbortController().signal)).rejects.toThrow('今日問候正在更新');
  expect(fetch).toHaveBeenCalledTimes(2);
  vi.mocked(fetch).mockClear().mockImplementation(() => Promise.resolve(envelope({...data, availableAt: '2026-11-11T03:00:00Z'})));
  await expect(getDailyGreeting(new AbortController().signal)).rejects.toThrow('今日問候正在更新');
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.mocked(fetch).mockClear().mockImplementation(() => Promise.resolve(envelope({...data, availableAt: '2026-11-11T03:00:00Z', nextRefreshAt: now})));
  await expect(getDailyGreeting(new AbortController().signal)).rejects.toThrow('今日問候正在更新');
  expect(fetch).toHaveBeenCalledTimes(1);
});
