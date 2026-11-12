import {describe, expect, it} from 'vitest';
import {cardHeight, cardWidth, sponsorForest, sponsorLayout, type SponsorBall} from './sponsor-map-layout';

function ball(id: string, parentId: string | null = null, sequence: number | null = null, day = 1): SponsorBall {
  return {
    id, parentId, sponsorSequenceNo: sequence,
    createdAt: new Date(Date.UTC(2026, 0, day)).toISOString(),
    ballNo: id, name: id, active: true, plan: 'STARTER'
  };
}

describe('recommendation overview', () => {
  it('preserves every root, unplaced child and direct sibling in deterministic order', () => {
    const balls = [
      ball('other'), ball('root'), ball('g', 'root'), ball('a', 'root', 2, 4), ball('b', 'root', 5),
      ball('c', 'root', 2, 2), ball('d', 'root', 1), ball('e', 'root', 2, 2),
      {...ball('f', 'root', 8), ballNo: null}, ball('grandchild', 'b')
    ];
    const forest = sponsorForest(balls);
    const whole = sponsorLayout(forest, null);
    expect(whole.rootCount).toBe(2);
    expect(whole.order.length).toBe(balls.length);
    expect(whole.levels).toBe(3);
    const siblings = forest.children.get('root')!;
    expect(siblings.map(child => child.id)).toEqual(['d', 'c', 'e', 'a', 'b', 'f', 'g']);
    const root = whole.positions.get('root')!;
    const first = whole.positions.get(siblings[0].id)!;
    const last = whole.positions.get(siblings[siblings.length-1].id)!;
    expect(root.direct).toBe(7);
    expect(first.x).toBeGreaterThanOrEqual(whole.positions.get('other')!.x + cardWidth);
    expect(root.x).toBe((first.x + last.x) / 2);
    expect(first.y).toBeGreaterThan(root.y + cardHeight);
    for (let i = 1; i < siblings.length; i++) {
      expect(whole.positions.get(siblings[i].id)!.x).toBeGreaterThan(whole.positions.get(siblings[i-1].id)!.x + cardWidth);
    }
    expect(whole.edges).not.toContain('NaN');
    expect(whole.positions.get('f')!.ball.ballNo).toBeNull();
    const branch = sponsorLayout(forest, 'b');
    expect(branch.order.map(node => [node.ball.id, node.depth])).toEqual([['b', 0], ['grandchild', 1]]);
    expect(branch.levels).toBe(2);
  });

  it('rejects duplicate balls, missing parents and disconnected cycles', () => {
    for (const invalid of [
      [ball('a'), ball('a')], [ball('orphan', 'gone')],
      [ball('root'), ball('x','y'), ball('y','x')], [ball('a','a')]
    ]) {
      expect(() => sponsorForest(invalid)).toThrow();
    }
    expect(sponsorLayout(sponsorForest([]), null).rootCount).toBe(0);
  });

  it('traverses ten thousand levels without a recursive render or a depth cutoff', () => {
    const count = 10_000;
    const chain = Array.from({length: count}, (_, i) => ball(String(i), i ? String(i-1) : null));
    const layout = sponsorLayout(sponsorForest(chain), null);
    expect(layout.order).toHaveLength(count);
    expect(layout.levels).toBe(count);
    expect(layout.positions.get(String(count-1))!.depth).toBe(count-1);
    expect(layout.width).toBeLessThan(cardWidth * 2);
  });

  it('places large independent business units side by side without inventing an upline', () => {
    const roots = Array.from({length: 1000}, (_, i) => ball(String(i)));
    const layout = sponsorLayout(sponsorForest(roots), null);
    expect(layout.levels).toBe(1);
    expect(layout.rootCount).toBe(1000);
    expect(layout.edges).toBe('');
    expect(layout.width).toBeGreaterThan(cardWidth * roots.length);
  });
});
