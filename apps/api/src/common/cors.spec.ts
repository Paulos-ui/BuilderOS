import { buildCorsOptions } from './cors';

/**
 * These tests exist because the CORS allowlist is a security boundary, not a
 * convenience. With `credentials: true`, any origin that gets through can read
 * authenticated responses for a logged-in user. The two cases that matter most
 * are the last two: arbitrary origins must be refused, and a lookalike host
 * must not squeeze past the preview pattern.
 */

type OriginFn = (
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
) => void;

/** Builds options under a temporary env, then restores it. */
function withEnv(env: Record<string, string | undefined>, run: (allow: (o?: string) => boolean) => void) {
  const saved = { ...process.env };
  Object.assign(process.env, env);

  try {
    const options = buildCorsOptions();
    const originFn = options.origin as OriginFn;

    const allow = (origin?: string): boolean => {
      let result = false;
      originFn(origin, (_err, ok) => {
        result = ok === true;
      });
      return result;
    };

    run(allow);
  } finally {
    process.env = saved;
  }
}

const PROD = {
  NODE_ENV: 'production',
  CORS_ORIGINS: 'https://builderos.vercel.app,https://builderos1.vercel.app',
  APP_BASE_URL: 'https://builderos3.vercel.app',
  VERCEL_PREVIEW_SUFFIX: undefined,
};

describe('buildCorsOptions', () => {
  it('allows every origin listed in CORS_ORIGINS', () => {
    withEnv(PROD, (allow) => {
      expect(allow('https://builderos.vercel.app')).toBe(true);
      expect(allow('https://builderos1.vercel.app')).toBe(true);
    });
  });

  it('still allows APP_BASE_URL, so existing deploys keep working', () => {
    withEnv(PROD, (allow) => {
      expect(allow('https://builderos3.vercel.app')).toBe(true);
    });
  });

  it('tolerates a trailing slash rather than silently rejecting', () => {
    withEnv(PROD, (allow) => {
      expect(allow('https://builderos.vercel.app/')).toBe(true);
    });
  });

  it('allows requests with no Origin header (curl, health checks)', () => {
    // Render's health probe sends no Origin. Rejecting these would make the
    // service look down.
    withEnv(PROD, (allow) => {
      expect(allow(undefined)).toBe(true);
    });
  });

  it('rejects an origin that is not listed', () => {
    withEnv(PROD, (allow) => {
      expect(allow('https://evil.example.com')).toBe(false);
    });
  });

  it('rejects localhost in production', () => {
    withEnv(PROD, (allow) => {
      expect(allow('http://localhost:3000')).toBe(false);
    });
  });

  it('allows localhost outside production', () => {
    withEnv({ ...PROD, NODE_ENV: 'development' }, (allow) => {
      expect(allow('http://localhost:3000')).toBe(true);
      expect(allow('http://localhost:3001')).toBe(true);
    });
  });

  it('does not treat http and https as interchangeable', () => {
    // Downgrading to http would expose the refresh cookie in transit.
    withEnv(PROD, (allow) => {
      expect(allow('http://builderos.vercel.app')).toBe(false);
    });
  });

  describe('Vercel preview deploys', () => {
    const WITH_PREVIEW = { ...PROD, VERCEL_PREVIEW_SUFFIX: 'jaykings-projects' };

    it('are blocked when no team slug is configured', () => {
      withEnv(PROD, (allow) => {
        expect(allow('https://builderos-git-main-jaykings-projects.vercel.app')).toBe(false);
      });
    });

    it('are allowed for our own team slug', () => {
      withEnv(WITH_PREVIEW, (allow) => {
        expect(allow('https://builderos-git-main-jaykings-projects.vercel.app')).toBe(true);
        expect(allow('https://builderos-a1b2c3-jaykings-projects.vercel.app')).toBe(true);
      });
    });

    it('are refused for any other team slug', () => {
      withEnv(WITH_PREVIEW, (allow) => {
        expect(allow('https://anything-someone-elses-team.vercel.app')).toBe(false);
      });
    });

    it('cannot be bypassed by a lookalike hostname', () => {
      // The whole point of anchoring the pattern. Each of these embeds our
      // slug somewhere but is not actually a host we control.
      withEnv(WITH_PREVIEW, (allow) => {
        expect(allow('https://jaykings-projects.vercel.app.evil.com')).toBe(false);
        expect(allow('https://evil-jaykings-projects.vercel.app.attacker.net')).toBe(false);
        expect(allow('https://x-jaykings-projects.vercel.app/../evil')).toBe(false);
      });
    });
  });

  it('enables credentials and caches the preflight', () => {
    withEnv(PROD, () => {
      const options = buildCorsOptions();
      expect(options.credentials).toBe(true);
      expect(options.maxAge).toBeGreaterThan(0);
      expect(options.methods).toContain('OPTIONS');
    });
  });
});
