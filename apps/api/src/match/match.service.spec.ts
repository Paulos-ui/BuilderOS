import { band, jaccard } from './match.service';

/**
 * These two functions are where a matching bug would be invisible. A wrong
 * weight produces a slightly odd list that nobody can prove is wrong; a wrong
 * band inverts the whole premise of the feature while still returning
 * confident-looking results. So they are tested directly rather than through
 * the service.
 */
describe('jaccard', () => {
  it('is 1 for identical sets', () => {
    expect(jaccard(['goat', 'base'], ['base', 'goat'])).toBe(1);
  });

  it('is 0 for disjoint sets', () => {
    expect(jaccard(['goat'], ['solana'])).toBe(0);
  });

  it('handles partial overlap', () => {
    // {goat, base} vs {base, solana} -> 1 shared, 3 union
    expect(jaccard(['goat', 'base'], ['base', 'solana'])).toBeCloseTo(1 / 3);
  });

  it('is 0 rather than NaN when both sides are empty', () => {
    // A builder who listed no chains must not divide by zero, and must not be
    // scored as a perfect context match against another blank profile.
    expect(jaccard([], [])).toBe(0);
  });

  it('ignores duplicates within a list', () => {
    expect(jaccard(['goat', 'goat'], ['goat'])).toBe(1);
  });
});

describe('band', () => {
  it('scores zero for builders with nothing in common', () => {
    expect(band(0)).toBe(0);
    expect(band(0.1)).toBe(0);
  });

  it('scores zero for a near-identical profile', () => {
    // The point of the whole function: a duplicate is not a collaborator.
    expect(band(0.99)).toBe(0);
    expect(band(1)).toBe(0);
  });

  it('peaks in the middle of the range', () => {
    expect(band(0.6)).toBeCloseTo(1);
  });

  it('ranks a moderately similar builder above a very similar one', () => {
    // This is the assertion that a plain nearest-neighbour search fails.
    expect(band(0.6)).toBeGreaterThan(band(0.95));
  });

  it('rises monotonically up to the peak', () => {
    expect(band(0.2)).toBeLessThan(band(0.4));
    expect(band(0.4)).toBeLessThan(band(0.6));
  });

  it('decays monotonically after the peak', () => {
    expect(band(0.7)).toBeGreaterThan(band(0.85));
    expect(band(0.85)).toBeGreaterThan(band(0.95));
  });

  it('never leaves 0-1', () => {
    for (let s = 0; s <= 1.0001; s += 0.01) {
      const v = band(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
