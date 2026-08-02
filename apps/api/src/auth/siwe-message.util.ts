interface BuildSiweMessageParams {
  domain: string;
  address: string;
  nonce: string;
  uri: string;
  chainId: number;
  statement: string;
}

export function buildSiweMessage({
  domain,
  address,
  nonce,
  uri,
  chainId,
  statement,
}: BuildSiweMessageParams): string {
  const issuedAt = new Date().toISOString();
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    statement,
    '',
    `URI: ${uri}`,
    `Version: 1`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');
}

export interface ParsedSiweMessage {
  address: string;
  nonce: string;
  domain: string;
  issuedAt: string;
}

/**
 * Deliberately tolerant parser: we control both the producer (buildSiweMessage
 * above) and the consumer, so we only need to reliably extract the fields we
 * check against — not implement the full EIP-4361 ABNF grammar.
 */
export function parseSiweMessage(raw: string): ParsedSiweMessage {
  const lines = raw.split('\n');
  const domainLine = lines[0] ?? '';
  const address = (lines[1] ?? '').trim();
  const nonceLine = lines.find((l) => l.startsWith('Nonce: '));
  const issuedAtLine = lines.find((l) => l.startsWith('Issued At: '));

  const domain = domainLine.replace(
    ' wants you to sign in with your Ethereum account:',
    '',
  );
  const nonce = nonceLine?.replace('Nonce: ', '').trim() ?? '';
  const issuedAt = issuedAtLine?.replace('Issued At: ', '').trim() ?? '';

  if (!address || !nonce) {
    throw new Error('Malformed SIWE message: missing address or nonce');
  }

  return { address, nonce, domain, issuedAt };
}
