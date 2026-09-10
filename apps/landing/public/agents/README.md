# Agent icons

Six identity icons, one per BuilderOS agent, served as static files from the
landing site at `/agents/<key>.svg`.

## Why these exist

`packages/chain/src/agents/manifests.ts` writes an `image` URL into the ERC-8004
registry for every agent it registers. That URL pointed at
`https://builderos.dev/agents/<key>.png` — a domain we do not own, and files that
had never been created. Registration succeeds regardless, so nothing surfaced it.
Both halves are fixed: the default origin is now the live Vercel deployment, and
these files exist.

## Keep them in sync with the console

The drawings here are the same geometry as `apps/console/components/AgentSigil.tsx`,
which renders them live in the product. Two copies exist because they do
different jobs: the component inherits the page's colour tokens and carries live
registration state, while these files must be self-contained with literal hex
values because a registry explorer renders them with no stylesheet.

If you change a mark, change both. The geometry is plain SVG path data in both
places and diffs cleanly.

One deliberate difference: the component's bottom anchor mark shows **two** brass
bars when the agent holds an on-chain identity and a dashed line when it does
not. These static files always draw a **single** solid brass bar, because an
identity icon should not make a claim about registration state — the registry
itself is the authority on that.

## Known gap

BuilderScout (#341) and ProofForge (#342) were registered before these files
existed, so their on-chain metadata still names `scout.png` and `forge.png`.
Updating a registry entry costs gas. The `image` field is cosmetic — discovery
works through `services[].endpoint` and the A2A agent card — so this is recorded
here rather than quietly patched. The four agents not yet registered will pick up
the `.svg` paths on their first registration.
