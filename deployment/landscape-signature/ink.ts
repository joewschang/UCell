export const PAGE_WIDTH = 900;
export const PAGE_HEIGHT = 300;

export type Turn = -1 | 0 | 1;
export type Point = { x: number; y: number };
export type Stroke = { points: Point[]; length: number };
export type Bounds = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

export function paperPoint(clientX: number, clientY: number, rect: Bounds, turn: Turn): Point | null {
  const across = clientX - rect.left;
  const down = clientY - rect.top;
  // The canvas is always displayed at 3:1. Use one scale for both axes.
  const extent = turn === 0 ? rect.width : rect.height;
  if (!extent || across < 0 || down < 0 || across > rect.width || down > rect.height) return null;
  const scale = PAGE_WIDTH / extent;
  if (turn === 1) return { x: down * scale, y: (rect.width - across) * scale };
  if (turn === -1) return { x: (rect.height - down) * scale, y: across * scale };
  return { x: across * scale, y: down * scale };
}

export function hasSignature(strokes: Stroke[]) {
  return strokes.reduce((length, stroke) => length + stroke.length, 0) > 30;
}

// The approved-contract API stores each axis independently in 0..1000.
// The display and the evidence page always restore the same 3:1 paper.
function unit(value: number, maximum: number) {
  return Math.max(0, Math.min(1000, Math.round(value * 1000 / maximum)));
}

export function contractInk(strokes: Stroke[]) {
  let travel = 0;
  let total = 0;
  const ink = strokes.map(stroke => {
    const line: number[][] = [];
    for (const p of stroke.points) {
      const x = unit(p.x, PAGE_WIDTH), y = unit(p.y, PAGE_HEIGHT);
      const last = line[line.length - 1];
      if (last && x === last[0] && y === last[1]) continue;
      if (last) travel += Math.hypot(x - last[0], y - last[1]);
      line.push([x, y]);
    }
    total += line.length;
    return line;
  });
  const overLimit = strokes.length > 150 || total > 10000;
  return { ink, valid: !overLimit && travel >= 40, overLimit };
}

function prepare(ctx: CanvasRenderingContext2D) {
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle = '#162e34';
}

export function drawSegment(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
  prepare(ctx);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

export function drawDot(ctx: CanvasRenderingContext2D, p: Point) {
  prepare(ctx);
  ctx.beginPath();
  ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPage(canvas: HTMLCanvasElement | null, strokes: Stroke[]) {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  for (const stroke of strokes) {
    const [first] = stroke.points;
    if (first) drawDot(ctx, first);
    for (let i = 1; i < stroke.points.length; i++) drawSegment(ctx, stroke.points[i - 1], stroke.points[i]);
  }
}
