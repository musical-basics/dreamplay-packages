# @dreamplay/analytics

Business-isolated analytics package for DreamPlay, MusicalBasics, and concert
funnels.

This package intentionally does not use click redirects. Email attribution is
captured from direct destination links containing `sid` and `cid`, then sent to
the configured business analytics endpoint.

## Installation

Install from the package subdirectory in GitHub:

```bash
pnpm add "github:musical-basics/dreamplay-packages#path:/packages/analytics"
```

This saves the dependency as:

```json
{
  "dependencies": {
    "@dreamplay/analytics": "github:musical-basics/dreamplay-packages#path:/packages/analytics"
  }
}
```

If the GitHub repo is private and the HTTPS shorthand has auth trouble, use SSH:

```bash
pnpm add "git+ssh://git@github.com:musical-basics/dreamplay-packages.git#path:/packages/analytics"
```

When this package changes, pull the latest committed build into a business repo:

```bash
pnpm update @dreamplay/analytics
```

## Browser Usage

```ts
import { createBusinessAnalytics } from "@dreamplay/analytics/client";

const analytics = createBusinessAnalytics({
  business: "concert",
  brand: "belgium-concert",
  offer: "belgium-2026",
  endpoint: "https://concert-analytics.example.com/api/track",
  sourceRepo: "belgium-concert-landing-page",
});

analytics.trackPageview();
```

For a single-page landing, install lifecycle tracking from a client component:

```ts
analytics.installPageLifecycleTracking({ trackPageview: true });
```

## Server Usage

```ts
import {
  analyticsSchemaForBusiness,
  parseBusinessAnalyticsEvent,
} from "@dreamplay/analytics/server";

const parsed = parseBusinessAnalyticsEvent(await request.json());
if (!parsed.ok) {
  return Response.json({ errors: parsed.errors }, { status: 400 });
}

const schema = analyticsSchemaForBusiness(parsed.event.metadata.business);
if (!schema) {
  return Response.json({ error: "Unknown analytics business" }, { status: 400 });
}
```

The server should enrich `metadata.email` from `metadata.sid`; the browser
package never exposes subscriber emails client-side.

## Supabase Setup

Use Option B: one Supabase project with separate schemas for each business.

```text
dreamplay_analytics.analytics_logs
musicalbasics_analytics.analytics_logs
concert_analytics.analytics_logs
```

Run this migration in the Supabase SQL editor:

```text
packages/analytics/supabase/001_business_analytics_schemas.sql
```

If your ingestion route writes through `@supabase/supabase-js`, add these schemas
to Supabase Project Settings -> API -> Exposed schemas:

```text
dreamplay_analytics
musicalbasics_analytics
concert_analytics
```

The migration grants table access to `service_role` only. Keep Supabase
service-role keys in server routes and environment variables; never put them in
client components.
