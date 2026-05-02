# Supabase Setup

This package uses Option B: one Supabase project with separate schemas per
business.

```text
dreamplay_analytics.analytics_logs
musicalbasics_analytics.analytics_logs
concert_analytics.analytics_logs
```

## Run The Migration

1. Open the Supabase project that will store business analytics.
2. Go to SQL Editor.
3. Paste and run:

   ```text
   packages/analytics/supabase/001_business_analytics_schemas.sql
   ```

The migration is idempotent, so it is safe to run again after pulling package
updates.

## Expose Schemas To The Server API

If your ingestion route writes through `@supabase/supabase-js`, Supabase
PostgREST must know about the schemas.

In Supabase:

1. Open Project Settings.
2. Open API.
3. Add these to Exposed schemas:

   ```text
   dreamplay_analytics
   musicalbasics_analytics
   concert_analytics
   ```

Only server-side routes should use these tables. The migration grants access to
`service_role`, not `anon` or `authenticated`.

## Insert Pattern

Use the helper exported by the package so every repo uses the same schema names.

```ts
import { analyticsSchemaForBusiness } from "@dreamplay/analytics/server";

const schema = analyticsSchemaForBusiness(event.metadata.business);
if (!schema) {
  return Response.json({ error: "Unknown analytics business" }, { status: 400 });
}

await supabase
  .schema(schema)
  .from("analytics_logs")
  .insert({
    event_name: event.event_name,
    path: event.path,
    session_id: event.session_id,
    anonymous_id: event.anonymous_id,
    tracker_version: event.tracker_version,
    metadata: event.metadata,
    ip_address: ipAddress,
    user_agent: request.headers.get("user-agent"),
  });
```

## Sanity Check

After running the migration, this query should show the analytics tables and
views in all three schemas:

```sql
select table_schema, table_name
from information_schema.tables
where table_schema in (
  'dreamplay_analytics',
  'musicalbasics_analytics',
  'concert_analytics'
)
order by table_schema, table_name;
```
