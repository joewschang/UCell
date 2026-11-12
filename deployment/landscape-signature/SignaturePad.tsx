import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { contractInk, drawDot, drawPage, drawSegment, hasSignature, PAGE_HEIGHT, PAGE_WIDTH, paperPoint } from './ink';
import type { Bounds, Stroke, Turn } from './ink';

type Props = {
  canvasRef: RefObject<HTMLCanvasElement>;
  disabled?: boolean;
  onInkChange: (valid: boolean) => void;
  onVectorsChange?: (ink: number[][][]) => void;
};

type Pen = { id: number; stroke: Stroke; bounds: Bounds; turn: Turn };

function portraitViewport() {
  return window.matchMedia('(orientation: portrait)').matches;
}

function changed(a: Stroke[], b: Stroke[]) {
  return a.length !== b.length || a.some((s, i) => s !== b[i]);
}

export default function SignaturePad({ canvasRef, disabled = false, onInkChange, onVectorsChange }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const paper = useRef<HTMLCanvasElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const committed = useRef<Stroke[]>([]);
  const draft = useRef<Stroke[]>([]);
  const cleared = useRef<Stroke[] | null>(null);
  const pen = useRef<Pen | null>(null);
  const gripPointer = useRef<number | null>(null);
  const title = useId();
  const [opened, setOpened] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [fallback, setFallback] = useState<Turn>(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [holding, setHolding] = useState(false);
  const [savedInk, setSavedInk] = useState(false);
  const [marks, setMarks] = useState({ count: 0, valid: false, overLimit: false });
  const turn: Turn = portrait ? fallback : 0;
  const writing = !portrait || fallback !== 0;

  function updateMarks() {
    const check = onVectorsChange ? contractInk(draft.current) : null;
    setMarks({ count: draft.current.length, valid: check?.valid ?? hasSignature(draft.current), overLimit: check?.overLimit ?? false });
  }

  function endPen(id?: number) {
    const current = pen.current;
    if (!current || (id !== undefined && id !== current.id)) return;
    pen.current = null;
    if (paper.current?.hasPointerCapture(current.id)) paper.current.releasePointerCapture(current.id);
    updateMarks();
  }

  function endGrip(id?: number) {
    if (id !== undefined && id !== gripPointer.current) return;
    gripPointer.current = null;
    setHolding(false);
  }

  function stopTouches() {
    endPen();
    endGrip();
  }

  useEffect(() => {
    if (!opened) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const media = window.matchMedia('(orientation: portrait)');
    function rotate() {
      stopTouches();
      setPortrait(media.matches);
      setFallback(0);
    }
    // A changing visible viewport (LINE chrome, rotation, split window) ends
    // only the current stroke. Vector coordinates remain in paper space.
    const resized = () => stopTouches();
    media.addEventListener('change', rotate);
    window.addEventListener('resize', resized);
    window.visualViewport?.addEventListener('resize', resized);
    window.addEventListener('blur', resized);
    return () => {
      document.body.style.overflow = previous;
      media.removeEventListener('change', rotate);
      window.removeEventListener('resize', resized);
      window.visualViewport?.removeEventListener('resize', resized);
      window.removeEventListener('blur', resized);
    };
  }, [opened]);

  useLayoutEffect(() => {
    const available = slot.current;
    if (!opened || !writing || !available) return;
    function fit() {
      if (!available) return;
      const width = Math.min(available.clientWidth, available.clientHeight * PAGE_WIDTH / PAGE_HEIGHT);
      if (width > 0) available.style.setProperty('--ls-paper-width', width + 'px');
    }
    fit();
    const observer = new ResizeObserver(() => { fit(); });
    observer.observe(available);
    drawPage(paper.current, draft.current);
    return () => observer.disconnect();
  }, [opened, writing, turn, confirmDiscard]);

  function open() {
    if (disabled || !dialog.current || dialog.current.open) return;
    draft.current = committed.current.slice();
    cleared.current = null;
    setConfirmDiscard(false);
    setPortrait(portraitViewport());
    setFallback(0);
    updateMarks();
    dialog.current.showModal();
    setOpened(true);
    dialog.current.focus({ preventScroll: true });
  }

  function close() {
    stopTouches();
    dialog.current?.close();
    setOpened(false);
    opener.current?.focus({ preventScroll: true });
  }

  function cancel() {
    stopTouches();
    if (changed(draft.current, committed.current)) setConfirmDiscard(true);
    else close();
  }

  function finish() {
    endPen();
    const check = onVectorsChange ? contractInk(draft.current) : null;
    const valid = check?.valid ?? hasSignature(draft.current);
    const emptyReplacement = savedInk && draft.current.length === 0;
    if (!valid && !emptyReplacement) return;
    if (changed(draft.current, committed.current)) {
      committed.current = draft.current.slice();
      drawPage(canvasRef.current, committed.current);
      setSavedInk(valid);
      onInkChange(valid);
      if (check && onVectorsChange) onVectorsChange(check.ink);
    }
    close();
  }

  function down(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled || !opened || !writing || pen.current || e.button !== 0) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const point = paperPoint(e.clientX, e.clientY, bounds, turn);
    const ctx = e.currentTarget.getContext('2d');
    if (!point || !ctx) return;
    e.preventDefault();
    const stroke: Stroke = { points: [point], length: 0 };
    pen.current = { id: e.pointerId, stroke, bounds, turn };
    cleared.current = null;
    draft.current.push(stroke);
    e.currentTarget.setPointerCapture(e.pointerId);
    drawDot(ctx, point);
    updateMarks();
  }

  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    const active = pen.current;
    if (!active || e.pointerId !== active.id) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    if (turn !== active.turn || Math.abs(active.bounds.left - rect.left) > 0.5 ||
        Math.abs(active.bounds.top - rect.top) > 0.5 || Math.abs(active.bounds.width - rect.width) > 0.5 ||
        Math.abs(active.bounds.height - rect.height) > 0.5) { endPen(active.id); return; }
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    const samples = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of [...samples, e.nativeEvent]) {
      const p = paperPoint(sample.clientX, sample.clientY, rect, turn);
      if (!p) { endPen(active.id); return; }
      const points = active.stroke.points;
      const previous = points[points.length - 1];
      const length = Math.hypot(p.x - previous.x, p.y - previous.y);
      if (!length) continue;
      drawSegment(ctx, previous, p);
      points.push(p);
      active.stroke.length += length;
    }
  }

  function undo() {
    endPen();
    if (draft.current.length) draft.current.pop();
    else if (cleared.current) { draft.current = cleared.current; cleared.current = null; }
    drawPage(paper.current, draft.current);
    updateMarks();
  }

  function clear() {
    endPen();
    cleared.current = draft.current.slice();
    draft.current = [];
    drawPage(paper.current, []);
    updateMarks();
  }

  return <div className="ls-signature">
    <div className="ls-preview-head"><strong>手寫簽名</strong>
      <button ref={opener} type="button" data-signature="open" className="ls-open" onClick={open} disabled={disabled}>
        {savedInk ? '編輯全螢幕簽名' : '全螢幕簽名'}
      </button></div>
    <button type="button" className="ls-preview" disabled={disabled} onClick={open}
      aria-label={savedInk ? '查看並編輯手寫簽名' : '開啟橫式簽名畫面'}>
      <canvas ref={canvasRef} width={PAGE_WIDTH} height={PAGE_HEIGHT} data-signature="preview" aria-label="手寫簽名預覽" />
      {!savedInk && <span>點此開啟橫式簽名區</span>}
    </button>
    {savedInk && <p className="ls-preview-note" role="status">請確認簽名方向與筆跡後，再送出。</p>}

    <dialog ref={dialog} data-signature="dialog" className="ls-sign-dialog" tabIndex={-1} aria-labelledby={title}
      onCancel={e => { e.preventDefault(); if (confirmDiscard) setConfirmDiscard(false); else cancel(); }}
      onClose={() => { stopTouches(); setOpened(false); }}>
      <div className="ls-frame" data-turn={turn}>
        {confirmDiscard ? <section className="ls-guide">
          <div className="ls-guide-inner"><h2 id={title}>放棄這次變更？</h2><p>返回後會顯示開啟簽名區前的筆跡。</p>
          <div className="ls-guide-actions"><button type="button" className="ls-primary" autoFocus onClick={() => setConfirmDiscard(false)}>繼續簽名</button>
          <button type="button" data-signature="discard" onClick={close}>放棄變更</button></div></div>
        </section> : !writing ? <section className="ls-guide" data-signature="orientation">
          <div className="ls-guide-inner">
            <span className="ls-phone" aria-hidden="true"><i /></span>
            <h2 id={title}>請將手機橫放</h2>
            <p>將手機頂端轉向左側，用左手按住左側固定區，右手簽名。</p>
            <p className="ls-guide-note">橫放後會自動開啟簽名區。若畫面仍是直式，可使用下方按鈕。</p>
            <div className="ls-guide-actions">
              <button type="button" data-signature="fallback" className="ls-primary" onClick={() => setFallback(1)}>已橫放，開啟橫式畫布</button>
              <button type="button" data-signature="cancel" onClick={cancel}>取消</button>
            </div>
          </div>
        </section> : <>
          <header className="ls-head"><h2 id={title}>橫式簽名</h2>
            <div className="ls-head-buttons">{turn !== 0 && <button type="button" data-signature="flip" onClick={() => { stopTouches(); setFallback(turn === 1 ? -1 : 1); }}>切換方向</button>}
              <button type="button" data-signature="cancel" onClick={cancel}>取消</button></div>
          </header>
          <div className="ls-workspace">
            <aside className="ls-grip" data-signature="grip" data-held={holding} onContextMenu={e => e.preventDefault()}
              onPointerDown={e => { if (gripPointer.current !== null) return; e.preventDefault(); gripPointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); setHolding(true); }}
              onPointerCancel={e => endGrip(e.pointerId)} onPointerUp={e => endGrip(e.pointerId)} onLostPointerCapture={e => endGrip(e.pointerId)}>
              <strong>{holding ? '已按住左側' : '左手固定區'}</strong>
              <span>請用左手按住左側，可以防止畫面移動跳脫</span>
            </aside>
            <div className="ls-paper-slot" ref={slot}><div className="ls-sheet">
              <canvas data-signature="paper" ref={paper} width={PAGE_WIDTH} height={PAGE_HEIGHT} aria-label="右手橫式簽名區"
                onPointerDown={down} onPointerMove={move} onPointerUp={e => { move(e); endPen(e.pointerId); }}
                onPointerCancel={e => endPen(e.pointerId)} onLostPointerCapture={e => endPen(e.pointerId)} />
              {marks.count === 0 && <span className="ls-watermark" aria-hidden="true">右手在此簽名</span>}
            </div></div>
          </div>
          <footer className="ls-foot">
            <div className="ls-tools"><button type="button" data-signature="undo" onClick={undo} disabled={!marks.count && !cleared.current}>{!marks.count && cleared.current ? '還原清除' : '復原上一筆'}</button>
              <button type="button" data-signature="clear" onClick={clear} disabled={!marks.count}>清除</button></div>
            {marks.count > 0 && !marks.valid && <small role="status">{marks.overLimit ? '筆跡超過上限，請復原上一筆或清除重簽' : '請完整簽下姓名'}</small>}
            <button type="button" data-signature="finish" className="ls-primary" onClick={finish} disabled={!marks.valid && !(savedInk && !marks.count)}>
              {savedInk && !marks.count ? '清除並返回' : '完成並預覽'}
            </button>
          </footer>
        </>}
      </div>
    </dialog>
  </div>;
}
