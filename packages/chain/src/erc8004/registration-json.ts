import { agentRegistryId, type GoatNetworkName } from '../config/networks';

export const REGISTRATION_TYPE =
  'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';

export type ServiceName = 'A2A' | 'MCP' | 'x402' | (string & {});

export interface AgentService {
  name: ServiceName;
  endpoint: string;
  version: string;
  skills?: string[];
  domains?: string[];
}

export interface AgentRegistrationRecord {
  agentRegistry: string;
  agentId: number;
}

export interface RegistrationDocument {
  type: string;
  name: string;
  description: string;
  image: string;
  services: AgentService[];
  x402Support: boolean;
  active: boolean;
  registrations: AgentRegistrationRecord[];
  supportedTrust?: string[];
}

/** The shape we author internally, before an agentId exists on-chain. */
export interface AgentManifest {
  /** Internal BuilderOS id, e.g. "scout" — not the on-chain agentId. */
  key: string;
  name: string;
  description: string;
  image: string;
  services: AgentService[];
  x402Support: boolean;
  active: boolean;
  supportedTrust?: string[];
}

export interface BuildRegistrationOptions {
  network: GoatNetworkName;
  /**
   * Assigned by the Identity Registry at registration time. Omit on the
   * first pass: register with a URI whose document has an empty
   * `registrations` array, then update the document and call setAgentURI
   * once the id is known. Chicken-and-egg is inherent to the spec.
   */
  agentId?: number;
}

/**
 * Produces a spec-compliant registration document from an internal manifest.
 *
 * Two invariants are enforced here rather than left to reviewers:
 *  - `x402Support: true` REQUIRES a matching `x402` service entry, so callers
 *    can actually locate the payment endpoint. The docs are explicit that
 *    x402Support is not a decorative field.
 *  - `supportedTrust` is omitted entirely when empty, rather than serialized
 *    as `[]`, since an empty array reads as "declared and none" instead of
 *    "not declared".
 */
export function buildRegistrationDocument(
  manifest: AgentManifest,
  options: BuildRegistrationOptions,
): RegistrationDocument {
  const { network, agentId } = options;

  if (manifest.x402Support) {
    const hasX402Service = manifest.services.some((s) => s.name === 'x402');
    if (!hasX402Service) {
      throw new Error(
        `Agent "${manifest.key}" declares x402Support: true but has no x402 service entry. ` +
          `Either add an x402 service endpoint or set x402Support to false.`,
      );
    }
  }

  if (manifest.services.length === 0) {
    throw new Error(`Agent "${manifest.key}" must declare at least one service.`);
  }

  const doc: RegistrationDocument = {
    type: REGISTRATION_TYPE,
    name: manifest.name,
    description: manifest.description,
    image: manifest.image,
    services: manifest.services,
    x402Support: manifest.x402Support,
    active: manifest.active,
    registrations:
      agentId === undefined
        ? []
        : [{ agentRegistry: agentRegistryId(network), agentId }],
  };

  if (manifest.supportedTrust && manifest.supportedTrust.length > 0) {
    doc.supportedTrust = manifest.supportedTrust;
  }

  return doc;
}

/**
 * Validates a document we did not author (e.g. another agent we discovered
 * through the registry and are considering calling). Returns the list of
 * problems; empty means structurally usable.
 */
export function validateRegistrationDocument(doc: unknown): string[] {
  const errors: string[] = [];
  if (typeof doc !== 'object' || doc === null) {
    return ['Document is not an object'];
  }
  const d = doc as Partial<RegistrationDocument>;

  if (d.type !== REGISTRATION_TYPE) {
    errors.push(`Unexpected type: ${String(d.type)}`);
  }
  if (!d.name) errors.push('Missing name');
  if (!d.description) errors.push('Missing description');
  if (!Array.isArray(d.services) || d.services.length === 0) {
    errors.push('Missing services');
  }
  if (typeof d.active !== 'boolean') errors.push('Missing active flag');

  if (d.x402Support === true) {
    const hasX402 = Array.isArray(d.services)
      ? d.services.some((s) => s?.name === 'x402')
      : false;
    if (!hasX402) {
      errors.push('x402Support is true but no x402 service endpoint is listed');
    }
  }

  return errors;
}
