# Moving BuilderOS to GOAT mainnet

## What the switch does, and does not do

```
GOAT_NETWORK=mainnet
```

This changes which chain the API **reads** from. Reads are free and safe —
flip it whenever you like.

It does **not** register your agents on mainnet. That is deliberate, and it
is the part worth thinking about.

## Why registration is gated separately

Your agents are registered on testnet3 as #341 and #342. Mainnet is a
different registry with different ids. Registering there is:

- **Permanent.** You cannot retract a record.
- **Paid.** Gas is real BTC.
- **Public.** It is the registry the GOAT ecosystem actually watches.

So an agent registered on mainnet pointing at an endpoint that cannot answer
is a permanent public record of an overclaim, on the network your reviewers
use. That is the one mistake in this project that cannot be patched out.

## Recommended sequence

**Now — switch reads only.**

```
GOAT_NETWORK=mainnet
```

The console will show that no agents are registered on mainnet yet, which is
true and costs you nothing.

**When ready — register the agents that genuinely operate.**

Four now qualify: BuilderScout, ProofForge, BuilderFlow and BuilderRep. Each
answers a real request.

```bash
cd packages/chain
# fund the owner address with mainnet BTC first
npm run register:agent -- --network mainnet --agent scout
```

Then record each new id so the API points at the right record:

```
AGENT_ID_SCOUT_MAINNET=<id>
AGENT_ID_FORGE_MAINNET=<id>
AGENT_ID_FLOW_MAINNET=<id>
AGENT_ID_REP_MAINNET=<id>
```

**Not yet — BuilderMatch and BuilderPay.**

BuilderMatch matches builders against each other and you have one profile in
the database. It would return empty results every time.

BuilderPay records usage but does not charge. Registering a settlement agent
that settles nothing is the same overclaim in a more expensive category.

## Turning on x402 charging

Metering is recorded from day one. Charging is a separate flag:

```
X402_METERING_ENABLED=true
GOATX402_API_URL=https://api.x402.goat.network
GOATX402_API_KEY=...
GOATX402_API_SECRET=...      # server-side only, never NEXT_PUBLIC_
GOATX402_MERCHANT_ID=...
```

Leave `X402_METERING_ENABLED` unset until you have decided what a scoring
call should cost and have tested settlement end to end. Usage data
accumulates in the meantime, which is what tells you what to charge.

## Render environment additions

```
GOAT_NETWORK=mainnet
X402_METERING_ENABLED=false
GOATX402_API_KEY=...
GOATX402_API_SECRET=...
GOATX402_MERCHANT_ID=...
```
