const audioUrl = '/assets/audio/admin_login_triumphant_fanfare.mp3';
// StrictMode can consume the same successful Entra exchange more than once.
const announced = new WeakSet<object>();
let stopCurrent: (() => void) | undefined;

export function stopLoginFanfare() {
  stopCurrent?.();
}

export function playLoginFanfare(exchange: object) {
  if (announced.has(exchange) || typeof Audio === 'undefined') return;
  announced.add(exchange);
  stopLoginFanfare();

  const audio = new Audio(audioUrl);
  const controls = document.createElement('div');
  controls.className = 'uc-login-fanfare';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', '登入音樂');
  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = '停止登入音樂';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.textContent = '略過';
  skip.hidden = true;
  controls.append(action, skip);
  let awaitingGesture = false;

  function stop() {
    if (stopCurrent !== stop) return;
    stopCurrent = undefined;
    document.removeEventListener('click', gesture, true);
    document.removeEventListener('keydown', gesture, true);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', stop);
    audio.pause();
    controls.remove();
  }

  async function play() {
    awaitingGesture = false;
    try {
      await audio.play();
      if (stopCurrent !== stop) return;
      action.textContent = '停止登入音樂';
      skip.hidden = true;
    } catch (error) {
      if (stopCurrent !== stop) return;
      if (!(error instanceof DOMException && error.name === 'NotAllowedError')) {
        stop();
        return;
      }
      awaitingGesture = true;
      action.textContent = '播放登入音樂';
      skip.hidden = false;
    }
    if (!controls.isConnected) document.body.append(controls);
  }

  function gesture(event: Event) {
    if (!awaitingGesture || !event.isTrusted || document.hidden) return;
    if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return;
    if (event.target instanceof Node && controls.contains(event.target)) return;
    void play();
  }

  function visibility() {
    if (document.hidden) stop();
    else void play();
  }

  stopCurrent = stop;
  action.onclick = () => awaitingGesture ? void play() : stop();
  skip.onclick = stop;
  audio.onended = stop;
  audio.onerror = stop;
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', visibility);
  document.addEventListener('click', gesture, true);
  document.addEventListener('keydown', gesture, true);
  if (!document.hidden) void play();
}
