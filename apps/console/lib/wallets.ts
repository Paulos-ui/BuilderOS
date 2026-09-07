"use client";

/**
 * Wallet discovery.
 *
 * The old code read `window.ethereum` directly. That breaks the moment a
 * builder has more than one wallet installed, which is common: every injected
 * wallet writes to the same `window.ethereum` slot, so whichever extension
 * loads last wins. Someone with MetaMask and OKX side by side would get
 * whichever one happened to boot second, with no way to choose — and no
 * indication that the other existed.
 *
 * EIP-6963 (Multi Injected Provider Discovery) exists precisely for this. Each
 * wallet announces itself as a separate object with its own name, icon and
 * reverse-DNS id, so we can list them and let the builder pick. Supported by
 * MetaMask, OKX, Rabby, Coinbase Wallet, Brave, Zerion, Phantom and others.
 *
 * `window.ethereum` is kept as a fallback for wallets that haven't adopted the
 * standard, but only when nothing announced — otherwise the same wallet would
 * appear twice.
 */

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export interface DiscoveredWallet {
  /** Reverse-DNS id from the spec (e.g. "io.metamask"), or a legacy label. */
  id: string;
  name: string;
  /** data: URI supplied by the extension. Absent for legacy providers. */
  icon?: string;
  provider: Eip1193Provider;
}

interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface Eip6963AnnounceEvent extends Event {
  detail?: {
    info?: Eip6963ProviderInfo;
    provider?: Eip1193Provider;
  };
}

/** Shape of the legacy injected object, including the flags wallets set. */
interface LegacyEthereum extends Eip1193Provider {
  isMetaMask?: boolean;
  isRabby?: boolean;
  isBraveWallet?: boolean;
  isOkxWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isTrust?: boolean;
  isFrame?: boolean;
  /** Pre-6963 multi-wallet convention, used by Coinbase among others. */
  providers?: LegacyEthereum[];
}

/**
 * Best-effort name for a provider that didn't announce itself. Order matters:
 * Brave and Rabby both set isMetaMask for compatibility, so their own flags
 * have to be checked first or everything reads as "MetaMask".
 */
function legacyName(p: LegacyEthereum): string {
  if (p.isBraveWallet) return "Brave Wallet";
  if (p.isRabby) return "Rabby";
  if (p.isOkxWallet) return "OKX Wallet";
  if (p.isCoinbaseWallet) return "Coinbase Wallet";
  if (p.isTrust) return "Trust Wallet";
  if (p.isFrame) return "Frame";
  if (p.isMetaMask) return "MetaMask";
  return "Browser wallet";
}

function collectLegacy(): DiscoveredWallet[] {
  const injected = (window as unknown as { ethereum?: LegacyEthereum }).ethereum;
  if (!injected) return [];

  // Some wallets expose every installed provider here rather than fighting
  // over the single slot.
  const list =
    Array.isArray(injected.providers) && injected.providers.length > 0
      ? injected.providers
      : [injected];

  const seen = new Set<string>();
  return list.reduce<DiscoveredWallet[]>((acc, p) => {
    const name = legacyName(p);
    if (seen.has(name)) return acc;
    seen.add(name);
    acc.push({ id: `legacy:${name}`, name, provider: p });
    return acc;
  }, []);
}

/**
 * Starts discovery and calls `onChange` as wallets appear.
 *
 * Announcements are usually synchronous, so the first callback typically fires
 * within a few milliseconds — fast enough that the UI never shows a spinner.
 * The listener stays attached because a few wallets announce late (slow
 * extension boot, or the user unlocking mid-page).
 *
 * Returns a cleanup function.
 */
export function discoverWallets(
  onChange: (wallets: DiscoveredWallet[]) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const found = new Map<string, DiscoveredWallet>();

  const handleAnnounce = (event: Event) => {
    const detail = (event as Eip6963AnnounceEvent).detail;
    const info = detail?.info;
    const provider = detail?.provider;
    if (!info?.rdns || !provider) return;
    if (found.has(info.rdns)) return; // rdns is the spec's unique key

    found.set(info.rdns, {
      id: info.rdns,
      name: info.name || info.rdns,
      icon: info.icon,
      provider,
    });
    onChange([...found.values()]);
  };

  window.addEventListener("eip6963:announceProvider", handleAnnounce);
  // Must listen before asking — wallets reply to this synchronously.
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  // Give announcements a moment, then fill in from window.ethereum only if
  // nothing modern turned up. Guarding on emptiness is what stops a
  // 6963-capable wallet being listed twice under two different names.
  const fallbackTimer = window.setTimeout(() => {
    if (found.size > 0) return;
    const legacy = collectLegacy();
    if (legacy.length === 0) return;
    legacy.forEach((w) => found.set(w.id, w));
    onChange([...found.values()]);
  }, 300);

  return () => {
    window.removeEventListener("eip6963:announceProvider", handleAnnounce);
    window.clearTimeout(fallbackTimer);
  };
}
