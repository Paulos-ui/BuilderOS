import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { AGENT_DEFINITIONS, statusFor } from './agents.config';
import { X402Service } from '../pay/x402.service';
import { NetworkConfig } from '../config/network.config';

/**
 * ── A2A agent card, at /.well-known/agent-card.json ───────────────────────
 *
 * BuilderScout (#341), ProofForge (#342) and BuilderFlow are registered in the
 * ERC-8004 Identity Registry on GOAT testnet3, and every one of those
 * registrations names this exact path as its A2A service endpoint. Until now it
 * returned 404.
 *
 * That is a worse failure than it looks. ERC-8004 registration is a public,
 * permanent claim: anyone resolving our identity — another agent looking for
 * grant discovery, or the ecosystem team assessing whether BuilderOS is real —
 * follows the pointer and finds nothing there. A dead well-known URL reads as
 * an abandoned project, and there is no way to tell it apart from one.
 *
 * ── Why one card for all six agents ───────────────────────────────────────
 *
 * A2A 0.3.0 models one card per agent endpoint, listing that agent's skills.
 * All six BuilderOS agents are served by one API deployment behind one origin,
 * so there is one card, and each agent appears as a skill group tagged with its
 * `agentId` where it has one. A caller that arrived from a specific registry
 * entry can find its agent by id; a caller browsing can see everything.
 *
 * ── Nothing here is unverified ────────────────────────────────────────────
 *
 * `skills`, `domains` and `endpoints` come from agents.config.ts, whose
 * internal invariants are pinned by agents.config.spec.ts. `agentId` values are
 * the registrations we actually hold. Capability claims are marked with
 * `implemented`, and an agent that is live but unregistered says so rather than
 * implying an on-chain identity it does not have.
 */
@Controller('.well-known')
export class AgentCardController {
  constructor(
    private readonly config: ConfigService,
    private readonly network: NetworkConfig,
    private readonly x402: X402Service,
  ) {}

  /**
   * Throttling skipped deliberately.
   *
   * This is a discovery document referenced from an immutable on-chain record.
   * Rate-limiting it means an agent that retries politely can be told to go
   * away, and the response is a few kilobytes of public, cacheable metadata
   * with no database access behind it.
   */
  @SkipThrottle()
  @Get('agent-card.json')
  card() {
    const apiBase = this.apiBase();
    const siteBase = this.siteBase();
    const x402 = this.x402.status();

    return {
      protocolVersion: '0.3.0',
      name: 'BuilderOS',
      description:
        'An agent-native operating system for builders seeking funding: discovers grants, hackathons and bounties, strengthens applications against reviewer criteria, tracks deadlines, finds complementary collaborators, issues portable credentials, and settles metered agent usage over x402 on GOAT Network.',
      url: apiBase,
      preferredTransport: 'JSONRPC',
      provider: {
        organization: 'BuilderOS',
        url: siteBase,
      },
      version: '0.1.0',
      documentationUrl: `${siteBase}/docs`,
      iconUrl: `${siteBase}/icon.png`,

      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false,
      },
      defaultInputModes: ['application/json'],
      defaultOutputModes: ['application/json'],

      /**
       * Flattened skill list, which is what A2A clients actually read.
       * `tags` carry the agent key and code so a caller can group them back.
       */
      skills: AGENT_DEFINITIONS.flatMap((d) =>
        d.skills.map((skill) => ({
          id: skill,
          name: skill
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' '),
          description: d.description,
          tags: [d.key, d.code, d.role.toLowerCase(), ...d.domains],
          inputModes: ['application/json'],
          outputModes: ['application/json'],
        })),
      ),

      /**
       * BuilderOS-specific extension: the per-agent view, with on-chain
       * identity where it exists. Namespaced under `x-builderos` so it cannot
       * be mistaken for a standard A2A field.
       */
      'x-builderos': {
        network: {
          name: this.network.name,
          chainId: this.network.chain.id,
          identityRegistry: this.network.registryId,
          explorer: this.network.explorerUrl,
        },
        agents: AGENT_DEFINITIONS.map((d) => ({
          key: d.key,
          code: d.code,
          name: d.name,
          role: d.role,
          description: d.description,
          skills: d.skills,
          domains: d.domains,
          status: statusFor(d),
          // Stated plainly: implemented is our claim, agentId is checkable.
          implemented: d.implemented,
          endpoints: d.endpoints.map((e) => `${apiBase}${e}`),
          x402Support: d.x402Support,
          agentId: d.agentId,
          registrationTx: d.registrationTx,
          explorerUrl: d.registrationTx
            ? `${this.network.explorerUrl}/tx/${d.registrationTx}`
            : null,
        })),
        payments: {
          protocol: 'x402',
          version: 1,
          endpoint: `${apiBase}/v1/x402/orders`,
          network: x402.network,
          asset: x402.asset,
          payTo: x402.payTo,
          active: x402.active,
          settlementMode: x402.settlementMode,
          note: x402.note,
        },
        registrations: {
          total: AGENT_DEFINITIONS.length,
          implemented: AGENT_DEFINITIONS.filter((d) => d.implemented).length,
          registered: AGENT_DEFINITIONS.filter((d) => d.agentId !== null).length,
          note: 'Agents are registered on-chain only once their endpoints answer requests. An implemented agent without an agentId is callable but has no ERC-8004 identity yet.',
        },
      },
    };
  }

  private apiBase(): string {
    return (
      this.config.get<string>('PUBLIC_API_BASE') ??
      this.config.get<string>('API_BASE_URL') ??
      'https://api.builderos.dev'
    ).replace(/\/$/, '');
  }

  private siteBase(): string {
    return (
      this.config.get<string>('PUBLIC_SITE_BASE') ?? 'https://builderos.dev'
    ).replace(/\/$/, '');
  }
}
