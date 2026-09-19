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

/** Minimum six display digits; it intentionally grows naturally past 999999. */
export function ballNoFor(treeCode: string, position: bigint): string {
  if (!/^[A-Z][A-Z0-9_-]{0,39}$/.test(treeCode) || position < 1n) throw new Error('BALL_IDENTIFIER_INVALID');
  const suffix = position <= 3n ? `X${position.toString().padStart(6, '0')}` : (position - 3n).toString().padStart(6, '0');
  return `${treeCode}${suffix}`;
}
