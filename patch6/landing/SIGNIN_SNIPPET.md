# Adding SIGN IN to the landing nav

The patch applies these automatically. This is here so you can verify what
changed, or reapply by hand if you have edited SiteNav.tsx.

**File:** `apps/landing/components/SiteNav.tsx`

## 1. Above the NAV_LINKS array

```tsx
const CONSOLE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_URL ?? "http://localhost:3001";
```

## 2. Desktop actions — before the JOIN BETA button

```tsx
<a
  href={`${CONSOLE_URL}/signin`}
  className="hidden rounded-sm px-3 py-2 font-mono text-[11px] tracking-[0.12em] text-paper-dim transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright md:inline-block"
>
  SIGN IN
</a>
```

## 3. Mobile drawer — before the JOIN BETA button

```tsx
<a
  href={`${CONSOLE_URL}/signin`}
  className="mt-4 block rounded-sm border border-line/40 px-4 py-3 text-center font-mono text-xs tracking-[0.1em] text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-bright"
>
  SIGN IN
</a>
```

## 4. Vercel env var on the LANDING project

```
NEXT_PUBLIC_CONSOLE_URL = https://your-console.vercel.app
```

Then redeploy — NEXT_PUBLIC_* values are baked in at build time.
