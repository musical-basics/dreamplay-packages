# @dreamplay/analytics

Business-isolated analytics package for DreamPlay, MusicalBasics, and concert
funnels.

New integrations should self-host the ingestion route and dashboard inside the
site repo. The old central DreamPlay Analytics app at
`data.dreamplaypianos.com` is legacy and writes to the older single-table
schema; do not point new package beacons at it.

## Quickstart

1. Install:

   ```bash
   pnpm add github:musical-basics/dreamplay-packages#path:/packages/analytics
   ```

2. Set env vars in `.env.local` and Vercel:

   ```bash
   ANALYTICS_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   ANALYTICS_SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   ```

   Vercel rejects sensitive variables on Development. For a linked Vercel
   project, this script provisions the URL in production, preview, and
   development, and the service-role key in production and preview:

   ```bash
   ANALYTICS_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
   ANALYTICS_SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
   bash node_modules/@dreamplay/analytics/scripts/vercel-env-setup.sh
   ```

3. Run the migration: paste `supabase/001_business_analytics_schemas.sql` into
   the Supabase SQL Editor.

4. **Expose the schemas** in Supabase -> Project Settings -> Data API ->
   Exposed schemas.

   Add:

   ```text
   dreamplay_analytics
   musicalbasics_analytics
   concert_analytics
   ```

   Click Save. Skipping this step makes every server query fail with `PGRST106`.

5. Wire the ingestion route, dashboard page, dashboard API routes, and beacon
   using the snippets below.

6. Verify: load the site, then check `concert_analytics.analytics_logs` for a
   row.

   ```sql
   select created_at, event_name, path, metadata
   from concert_analytics.analytics_logs
   order by created_at desc
   limit 10;
   ```

### Step 5a: Ingestion Route

Create `app/api/track/route.ts`:

```ts
import {
  createBusinessAnalyticsTrackHandler,
  createBusinessAnalyticsTrackOptionsHandler,
} from "@dreamplay/analytics/track-server";

const options = {
  supabaseUrl: process.env.ANALYTICS_SUPABASE_URL!,
  supabaseServiceRoleKey: process.env.ANALYTICS_SUPABASE_SERVICE_ROLE_KEY!,
  business: "concert",
} as const;

export const POST = createBusinessAnalyticsTrackHandler(options);
export const OPTIONS = createBusinessAnalyticsTrackOptionsHandler(options);
```

### Step 5b: Dashboard Page

Create `app/analytics/page.tsx`:

```tsx
import { AnalyticsDashboard } from "@dreamplay/analytics/dashboard";

export default function AnalyticsPage() {
  return (
    <AnalyticsDashboard
      accentLabel="Concert"
      title="Analytics"
      apiBasePath="/api/analytics"
    />
  );
}
```

### Step 5c: Dashboard API Routes

Create `app/api/analytics/stats/route.ts`:

```ts
import { createAnalyticsDashboardStatsHandler } from "@dreamplay/analytics/dashboard-server";

export const dynamic = "force-dynamic";

export const GET = createAnalyticsDashboardStatsHandler({
  supabaseUrl: process.env.ANALYTICS_SUPABASE_URL!,
  supabaseServiceRoleKey: process.env.ANALYTICS_SUPABASE_SERVICE_ROLE_KEY!,
  business: "concert",
});
```

Create `app/api/analytics/visitor-history/route.ts`:

```ts
import { createAnalyticsDashboardVisitorHistoryHandler } from "@dreamplay/analytics/dashboard-server";

export const dynamic = "force-dynamic";

export const GET = createAnalyticsDashboardVisitorHistoryHandler({
  supabaseUrl: process.env.ANALYTICS_SUPABASE_URL!,
  supabaseServiceRoleKey: process.env.ANALYTICS_SUPABASE_SERVICE_ROLE_KEY!,
  business: "concert",
});
```

Create `app/api/analytics/email-visitors/route.ts`:

```ts
import { createAnalyticsDashboardEmailVisitorsHandler } from "@dreamplay/analytics/dashboard-server";

export const dynamic = "force-dynamic";

export const GET = createAnalyticsDashboardEmailVisitorsHandler({
  supabaseUrl: process.env.ANALYTICS_SUPABASE_URL!,
  supabaseServiceRoleKey: process.env.ANALYTICS_SUPABASE_SERVICE_ROLE_KEY!,
  business: "concert",
});
```

### Step 5d: Beacon

For the standard self-hosted setup, omit `endpoint`. The client defaults to
same-origin `/api/track`.

```tsx
"use client";

import { useEffect, useMemo } from "react";
import { createBusinessAnalytics } from "@dreamplay/analytics/client";

export function AnalyticsBeacon() {
  const analytics = useMemo(
    () =>
      createBusinessAnalytics({
        business: "concert",
        brand: "belgium-concert",
        offer: "belgium-2026",
        sourceRepo: "belgium-concert-landing-page",
      }),
    []
  );

  useEffect(() => {
    return analytics.installPageLifecycleTracking({ trackPageview: true });
  }, [analytics]);

  return null;
}
```

Only pass an endpoint when intentionally sending events to another deploy:

```ts
const remoteAnalyticsUrl = process.env.NEXT_PUBLIC_DREAMPLAY_ANALYTICS_URL;

const analytics = createBusinessAnalytics({
  business: "concert",
  brand: "belgium-concert",
  endpoint: remoteAnalyticsUrl
    ? `${remoteAnalyticsUrl.replace(/\/$/, "")}/api/track`
    : undefined,
});
```

## Wire Format

The browser client sends this shape to `/api/track`. Manual smoke tests can send
the same canonical snake_case fields:

```bash
curl -X POST http://localhost:3000/api/track \
  -H 'Content-Type: application/json' \
  -A 'Mozilla/5.0 analytics-smoke-test' \
  --data '{
    "event_name": "pageview",
    "path": "/?utm_source=smoke",
    "session_id": "s_smoke",
    "anonymous_id": "a_smoke",
    "tracker_version": "curl-smoke",
    "metadata": {
      "business": "concert",
      "brand": "belgium-concert",
      "host": "localhost:3000",
      "referrer": null,
      "utm_source": "smoke"
    }
  }'
```

Field notes:

- `event_name`, `path`, `session_id`, `anonymous_id`, `tracker_version`, and
  `metadata` are required.
- `eventName` and `sessionId` are accepted as backward-compatible aliases, but
  manual tests should prefer `event_name` and `session_id`.
- `metadata.business` must match the self-hosted route's `business` option. For
  known businesses, that maps to `dreamplay_analytics`,
  `musicalbasics_analytics`, or `concert_analytics`.
- `metadata.host` is required and `metadata.referrer` is used for source
  reporting.
- Dashboard handlers filter likely bots by default. To include curl or other
  automation test rows while verifying setup, use
  `/api/analytics/stats?exclude_bots=false` or
  `/api/analytics/stats?excludeBots=false`.

## Server Diagnostics

The ingestion route and dashboard handlers perform a lazy schema-exposure check
once per cold start. If Supabase Data API exposure is missing, they log:

```text
[@dreamplay/analytics] schema 'concert_analytics' is not exposed in PostgREST. Add it in Supabase -> Project Settings -> Data API -> Exposed schemas.
```

and return:

```json
{
  "error": "analytics schema not exposed",
  "fix": "https://supabase.com/dashboard/project/YOUR_PROJECT_REF/settings/api"
}
```

## Visit Classification

Dashboards can use the shared classifier to label email-attributed pageviews
consistently across businesses.

```ts
import { classifyVisit } from "@dreamplay/analytics/classification";

const result = classifyVisit(events);

result.classification;
// "scanner_likely" | "bot_likely" | "human_likely" | "human_confirmed" | "unknown"
```

Typical dashboard interpretation:

```text
emailAttributed: true
scannerLikely: true
humanConfirmed: false
```

means the visit should count as an email-attributed landed pageview, but not as a
confirmed human visit. This is useful for direct `sid/cid` tracking because
security scanners can load links without a real reader intentionally visiting
the page.

## Supabase Details

The package uses one Supabase project with separate schemas per business:

```text
dreamplay_analytics.analytics_logs
musicalbasics_analytics.analytics_logs
concert_analytics.analytics_logs
```

The migration grants table access to `service_role` only. Keep Supabase
service-role keys in server routes and environment variables; never put them in
client components.
