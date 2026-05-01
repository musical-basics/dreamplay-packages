# @dreamplay/analytics

Business-isolated analytics package for DreamPlay, MusicalBasics, and concert
funnels.

This package intentionally does not use click redirects. Email attribution is
captured from direct destination links containing `sid` and `cid`, then sent to
the configured business analytics endpoint.

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
import { parseBusinessAnalyticsEvent } from "@dreamplay/analytics/server";

const parsed = parseBusinessAnalyticsEvent(await request.json());
if (!parsed.ok) {
  return Response.json({ errors: parsed.errors }, { status: 400 });
}
```

The server should enrich `metadata.email` from `metadata.sid`; the browser
package never exposes subscriber emails client-side.
