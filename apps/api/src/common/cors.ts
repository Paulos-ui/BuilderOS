import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { Logger } from '@nestjs/common';

const logger = new Logger('Cors');

/**
 * CORS allowlist.
 *
 * This replaced `origin: process.env.APP_BASE_URL`, which passed a single
 * string. A single string means exactly one deployment can talk to this API —
 * every other frontend gets an `Access-Control-Allow-Origin` header naming
 * some *other* host and the browser refuses the response. That is the failure
 * we hit with two live Vercel projects.
 *
 * Two rules shape everything below, both because `credentials: true` is on:
 *
 *  1. Never reflect an arbitrary origin back. With credentials enabled, the
 *     reflected origin is granted read access to authenticated responses,
 *     including anything set by the httpOnly refresh cookie. Reflecting
 *     whatever the caller sent is the same as having no policy at all.
 *
 *  2. Never match `*.vercel.app` broadly. Anyone can deploy to vercel.app in
 *     seconds, so that pattern hands every attacker a trusted origin. Preview
 *     matching is scoped to one team slug, which only we can publish under.
 */

/** Local dev origins. Added only outside production. */
const DEV_ORIGINS = [
  'http://localhost:3000', // landing
  'http://localhost:3001', // console
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, '')) // tolerate trailing slashes
    .filter(Boolean);
}

/**
 * Vercel gives every preview deploy its own hostname, shaped like:
 *   builderos-git-<branch>-<team-slug>.vercel.app
 *   builderos-<build-hash>-<team-slug>.vercel.app
 *
 * Anchoring on the team slug is what makes this safe — a third party cannot
 * publish under our slug. Set VERCEL_PREVIEW_SUFFIX to that slug (for example
 * "jaykings-projects") to let branch previews reach this API. Leave it unset
 * and previews are simply not allowed, which is a fine default.
 */
function previewPattern(): RegExp | null {
  const suffix = process.env.VERCEL_PREVIEW_SUFFIX?.trim();
  if (!suffix) return null;

  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^https://[a-z0-9-]+-${escaped}\\.vercel\\.app$`, 'i');
}

export function buildCorsOptions(): CorsOptions {
  const isProduction = process.env.NODE_ENV === 'production';

  // CORS_ORIGINS is the real control. APP_BASE_URL is still read so existing
  // deployments keep working, and because auth.service.ts uses it as the SIWE
  // `uri` — the two are related but not interchangeable, so both feed in here.
  const allowlist = new Set<string>([
    ...parseList(process.env.CORS_ORIGINS),
    ...parseList(process.env.APP_BASE_URL),
    ...(isProduction ? [] : DEV_ORIGINS),
  ]);

  const preview = previewPattern();

  logger.log(
    `Allowed origins: ${allowlist.size ? [...allowlist].join(', ') : '(none configured)'}`,
  );
  logger.log(
    preview
      ? `Vercel previews allowed for team slug: ${process.env.VERCEL_PREVIEW_SUFFIX}`
      : 'Vercel preview deploys: not allowed (set VERCEL_PREVIEW_SUFFIX to enable)',
  );

  if (isProduction && allowlist.size === 0) {
    // Loud, but not fatal — a misconfigured allowlist should be obvious in the
    // logs rather than silently blocking every browser request.
    logger.error(
      'No CORS origins configured in production. Every browser request will be blocked. Set CORS_ORIGINS.',
    );
  }

  return {
    origin(
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) {
      // Same-origin requests, server-to-server calls, curl and health checks
      // send no Origin header. There is no cross-origin risk to gate here, and
      // rejecting them would break Render's own health probing.
      if (!requestOrigin) {
        callback(null, true);
        return;
      }

      const normalized = requestOrigin.replace(/\/+$/, '');

      if (allowlist.has(normalized) || preview?.test(normalized)) {
        callback(null, true);
        return;
      }

      // Log the rejected origin — when a new deploy URL appears this line is
      // the fastest way to see exactly what to add to CORS_ORIGINS.
      logger.warn(`Blocked cross-origin request from: ${requestOrigin}`);

      // `false` makes the browser surface a clean CORS failure. Passing an
      // Error here would instead produce a 500, which looks like the API is
      // broken rather than the origin being unlisted.
      callback(null, false);
    },
    credentials: true, // required for the httpOnly refresh cookie
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Cache the preflight so the browser stops re-asking on every request.
    maxAge: 86_400,
  };
}
