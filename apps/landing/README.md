# BuilderOS — Landing Page

A scroll-driven marketing surface for **BuilderOS**, the AI-native operating
system for Web3 builders. Built as a real Next.js 15 app, not a static mockup.

## Concept

The page's central metaphor: **you're watching an operating system get
drafted, live, on a blueprint table.** A persistent grid backdrop, a
CAD-style coordinate HUD, and a headline that plots itself in stroke by
stroke all set up the same idea the product delivers — turning scattered,
noisy builder work into a coordinated, legible system.

| Layer | What it does |
|---|---|
| **BlueprintField** | Fixed background grid + drafting-sheet frame, breathes subtly with total scroll progress |
| **ScrollHUD** | Corner readout (section + %) — a functional instrument, not decorative page numbers |
| **Hero** | Headline plots in letter-by-letter; radiating construction lines draw the "BuilderOS" origin node; exits via parallax |
| **ProblemSection** | Opportunity fragments (real program names) scatter and dissolve via scroll-scrubbed parallax |
| **AgentConstellation** | Pinned 500vh section — the 6 agents light up and connect sequentially as you scroll, or on hover |
| **PipelineSection** | A schematic path with a scroll-scrubbed cursor tracing Discover → Apply → Build → Prove |
| **ReputationSection** | A Three.js seal rotates and shifts from rough blueprint-blue to polished brass as scroll progress increases — visualizing work being minted into an attestation |
| **AboutDocs** | Pinned spec-sheet section, cross-fading between Vision / How it Works / User Guide / Features as you scroll |
| **CTAFooter** | A seal "stamps down" into place as the final section enters view, then the waitlist form |

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** (CSS-first `@theme` tokens in `app/globals.css` — no `tailwind.config.ts`)
- **Framer Motion** for all scroll-linked transforms (`useScroll`, `useTransform`, `useMotionValueEvent`) — no `whileInView` fades
- **Lenis** for inertia smooth-scroll, driven from a single shared `requestAnimationFrame` loop so every scroll-linked animation reads the same frame
- **Three.js + @react-three/fiber** for the scroll-scrubbed reputation seal (dynamically imported, client-only)

## Design tokens

Defined in `app/globals.css` under `@theme`:

| Token | Hex | Use |
|---|---|---|
| `--color-ink` | `#0B1420` | Background |
| `--color-paper` | `#EAE4D3` | Primary text |
| `--color-line` | `#3E7CA6` | Grid, schematic lines |
| `--color-brass` | `#B8863B` | CTAs, active states |
| `--color-signal` | `#6FA98A` | Verified / on-chain states |

Type: **Sora** (display) + **IBM Plex Sans** (body) + **IBM Plex Mono** (coordinate/agent-ID annotations).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** `next/font/google` fetches font files at build time and needs an
> open connection to `fonts.googleapis.com`. This is normal on any machine
> with internet access (including Vercel) — it just doesn't work inside a
> network-restricted sandbox.

## Build & deploy

```bash
npm run build
npm run start   # or: deploy the repo directly to Vercel
```

Deploying to **Vercel**: push this folder to a GitHub repo, import it at
vercel.com/new, no config needed — Next.js is auto-detected.

## Editing content

All agent copy lives in one place: `data/agents.ts` (`AGENTS` and
`PIPELINE_STEPS`). Documentation copy for the "About the Project" section
lives in `components/AboutDocs.tsx` (`DOC_SECTIONS`). Update those and every
section that references them (constellation, pipeline, docs) updates
automatically.

## Accessibility

- `prefers-reduced-motion` is respected globally (`app/globals.css`) —
  animation/transition durations collapse to near-zero.
- All interactive agent nodes are real `<button>` elements with
  `aria-label`s and keyboard focus/blur handlers (not just hover-only divs).
- Text contrast (paper on ink) exceeds WCAG AA at body sizes.

## Known follow-ups before shipping to production

- Wire the waitlist form (`CTAFooter.tsx`) to a real endpoint (e.g. a
  BuilderOS API route or a service like Resend/ConvertKit) instead of local
  state.
- Add a wallet-connect flow (wagmi/viem) behind "Connect wallet" once the
  BuilderOS auth service is live — see the main blueprint doc for the
  intended architecture.
- Add OG image generation (`opengraph-image.tsx`) for social sharing.
