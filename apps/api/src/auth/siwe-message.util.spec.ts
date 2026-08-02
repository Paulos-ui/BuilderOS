import { buildSiweMessage, parseSiweMessage } from './siwe-message.util';

describe('siwe-message.util', () => {
  const address = '0x1234567890123456789012345678901234567890';

  it('round-trips address and nonce through build -> parse', () => {
    const message = buildSiweMessage({
      domain: 'builderos.dev',
      address,
      nonce: 'abc123nonce',
      uri: 'http://localhost:3000',
      chainId: 1,
      statement: 'Sign in to BuilderOS.',
    });

    const parsed = parseSiweMessage(message);

    expect(parsed.address).toBe(address);
    expect(parsed.nonce).toBe('abc123nonce');
    expect(parsed.domain).toBe('builderos.dev');
    expect(parsed.issuedAt).not.toBe('');
  });

  it('throws on a malformed message missing a nonce', () => {
    const malformed = 'builderos.dev wants you to sign in:\n' + address;
    expect(() => parseSiweMessage(malformed)).toThrow(
      /missing address or nonce/,
    );
  });
});
