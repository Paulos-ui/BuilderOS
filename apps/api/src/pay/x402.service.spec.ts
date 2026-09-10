import { formatMinor, isUniqueViolation } from './x402.service';
import { PRICE_LIST, priceFor } from './pricing.config';

/**
 * These are the parts of BuilderPay that can be wrong without anything looking
 * broken. A bad price lookup charges for the wrong thing; bad minor-unit
 * formatting shows a builder a number that is off by three orders of magnitude
 * next to the word USDC. Both would ship silently, so both are tested directly.
 *
 * Signature verification is not unit-tested here — it delegates to viem's
 * verifyTypedData, and a test that mocks it would only assert that the mock was
 * called. What IS tested is the arithmetic and lookup around it, which is ours.
 */
describe('formatMinor', () => {
  it('places the decimal point for a 6-decimal asset', () => {
    expect(formatMinor('2500', 6, 'USDC')).toBe('0.0025 USDC');
  });

  it('handles whole units', () => {
    expect(formatMinor('1000000', 6, 'USDC')).toBe('1 USDC');
  });

  it('handles zero', () => {
    expect(formatMinor('0', 6, 'USDC')).toBe('0 USDC');
  });

  it('does not lose precision on values beyond Number.MAX_SAFE_INTEGER', () => {
    // 1 token of an 18-decimal asset. Number(1e18)/1e18 happens to survive, but
    // this value does not: the naive version returns 9007199254.740993.
    expect(formatMinor('9007199254740993123456789', 18, 'BTC')).toBe(
      '9007199.254740993123456789 BTC',
    );
  });

  it('trims trailing zeros but keeps significant ones', () => {
    expect(formatMinor('1050000', 6, 'USDC')).toBe('1.05 USDC');
    expect(formatMinor('1000100', 6, 'USDC')).toBe('1.0001 USDC');
  });

  it('pads values smaller than one minor unit group', () => {
    expect(formatMinor('1', 6, 'USDC')).toBe('0.000001 USDC');
  });

  it('handles a zero-decimal asset', () => {
    expect(formatMinor('42', 0, 'PTS')).toBe('42 PTS');
  });

  it('returns the raw value rather than a wrong number for non-numeric input', () => {
    // Better to show something obviously odd than a confidently wrong amount.
    expect(formatMinor('not-a-number', 6, 'USDC')).toBe('not-a-number USDC');
  });
});

describe('priceFor', () => {
  it('finds a priced operation', () => {
    const price = priceFor('forge', 'score');
    expect(price).not.toBeNull();
    expect(price?.amountMinor).toBe('2500');
  });

  it('returns null for an unpriced operation, so it is served free', () => {
    expect(priceFor('flow', 'pipeline')).toBeNull();
    expect(priceFor('rep', 'credentials')).toBeNull();
  });

  it('returns null rather than throwing for an unknown agent', () => {
    expect(priceFor('nonexistent', 'whatever')).toBeNull();
  });
});

describe('PRICE_LIST', () => {
  it('keys every entry consistently with its own fields', () => {
    // A mismatch here means priceFor() and the published quote disagree, and
    // the client would be charged a different amount than it was quoted.
    for (const [key, entry] of Object.entries(PRICE_LIST)) {
      expect(key).toBe(`${entry.agentKey}:${entry.operation}`);
    }
  });

  it('states every amount as a positive integer string', () => {
    for (const entry of Object.values(PRICE_LIST)) {
      expect(entry.amountMinor).toMatch(/^\d+$/);
      expect(BigInt(entry.amountMinor) > 0n).toBe(true);
    }
  });

  it('gives every entry a description, since the 402 body shows it to the payer', () => {
    for (const entry of Object.values(PRICE_LIST)) {
      expect(entry.description.length).toBeGreaterThan(10);
    }
  });
});

describe('isUniqueViolation', () => {
  it('recognises the Prisma unique-constraint code', () => {
    // This is what stands between us and replayed payment authorizations.
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true);
  });

  it('does not treat other errors as replays', () => {
    expect(isUniqueViolation({ code: 'P2003' })).toBe(false);
    expect(isUniqueViolation(new Error('connection lost'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
