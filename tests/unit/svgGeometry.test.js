import { describe, expect, it } from 'vitest';
import { compactPoints, makeEdgeGeometry, pointsToPath } from '../../src/lib/svgGeometry';

describe('SVG geometry', () => {
  it('removes duplicate points and builds a stable path', () => {
    const points = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(compactPoints(points)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(pointsToPath(points)).toBe('M 0 0 L 10 0');
  });

  it('uses the longest segment and guarantees a 44px touch target', () => {
    const geometry = makeEdgeGeometry([{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 100 }]);
    expect(geometry.angle).toBe(90);
    expect(geometry.centerX).toBe(12);
    expect(geometry.centerY).toBe(50);
    expect(geometry.hitWidth).toBeGreaterThanOrEqual(44);
    expect(geometry.hitHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.visibleFirstPath).not.toContain('NaN');
  });
});
