import { getSnapshot } from '@/lib/data/load';

/**
 * The integration status report, as a static JSON artifact.
 *
 * Emitted as a route rather than copied into `out/` after the fact: Vercel's
 * Next.js builder captures the exported output at the end of `next build`, so
 * anything written afterwards never reaches the deployment. A force-static
 * route handler is part of the build, so it does.
 *
 * Public by construction — it is generated from `buildIntegrationReport`, which
 * redacts every error string and publishes credential variable *names* only.
 */
export const dynamic = 'force-static';

export async function GET() {
  const { report } = await getSnapshot();

  return new Response(JSON.stringify(report, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Short cache: the file is regenerated on every rebuild, and the smoke
      // test reads it to prove a scheduled refresh actually happened.
      'cache-control': 'public, max-age=60, s-maxage=60',
    },
  });
}
