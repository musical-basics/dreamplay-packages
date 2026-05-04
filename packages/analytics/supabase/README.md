# Supabase Setup

Use the top-level package README Quickstart first. The important order is:

1. Run `001_business_analytics_schemas.sql` in the Supabase SQL Editor.
2. Open Supabase -> Project Settings -> Data API -> Exposed schemas.
3. Add:

   ```text
   dreamplay_analytics
   musicalbasics_analytics
   concert_analytics
   ```

Skipping the exposed-schemas step makes server routes fail with `PGRST106`.

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
