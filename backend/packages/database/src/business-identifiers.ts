/**
 * Business identifier helpers deliberately use bigint. Binary topology must not
 * pass through JavaScript Number, which loses identity precision after 2^53-1.
 */
export function binaryPath(position: bigint): string {
  if (position < 1n) throw new Error('BINARY_POSITION_INVALID');
  return 'R' + position.toString(2).slice(1).replaceAll('0', 'L').replaceAll('1', 'R');
}

export function binaryParent(position: bigint): bigint | null {
  if (position < 1n) throw new Error('BINARY_POSITION_INVALID');
  return position === 1n ? null : position / 2n;
}

export function binarySide(position: bigint): 'LEFT' | 'RIGHT' | null {
  if (position < 1n) throw new Error('BINARY_POSITION_INVALID');
  return position === 1n ? null : position % 2n === 0n ? 'LEFT' : 'RIGHT';
}

export function childPosition(position: bigint, side: 'LEFT' | 'RIGHT'): bigint {
  if (position < 1n) throw new Error('BINARY_POSITION_INVALID');
  return position * 2n + (side === 'RIGHT' ? 1n : 0n);
}

/** Ordinary Ball numbers use an allocated per-tree sequence, never a heap position. */
export function ballNoFor(treeCode: string, sequence: bigint): string {
  if (!/^[A-Z][A-Z0-9_-]{0,39}$/.test(treeCode) || sequence < 1n) throw new Error('BALL_IDENTIFIER_INVALID');
  return `${treeCode}${sequence.toString().padStart(6, '0')}`;
}

/** Only the three original Company bootstrap Balls retain position-based numbers. */
export function bootstrapBallNoFor(treeCode: string, position: bigint): string {
  if (position < 1n || position > 3n) throw new Error('BOOTSTRAP_POSITION_INVALID');
  ballNoFor(treeCode, position);
  return `${treeCode}X${position.toString().padStart(6, '0')}`;
}
