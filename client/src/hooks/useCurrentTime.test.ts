import { describe, expect, it } from 'vitest';
import { getRemainingSeconds } from './useCurrentTime';

describe('getRemainingSeconds', () => {
  it('keeps the final partial second visible without adding an extra second', () => {
    expect(getRemainingSeconds(10_100, 9_100)).toBe(1);
    expect(getRemainingSeconds(10_100, 9_101)).toBe(1);
  });

  it('clamps expired deadlines to zero', () => {
    expect(getRemainingSeconds(10_100, 10_100)).toBe(0);
    expect(getRemainingSeconds(10_100, 10_500)).toBe(0);
  });
});
