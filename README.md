# DreamPlay Packages

Shared packages used by the business repos.

Current package:

- `@dreamplay/analytics` - browser-side event tracker and shared analytics helpers
  - includes Supabase Option B setup SQL at
    `packages/analytics/supabase/001_business_analytics_schemas.sql`

## Install From GitHub

Install only the analytics package subdirectory:

```bash
pnpm add "github:musical-basics/dreamplay-packages#path:/packages/analytics"
```

Then import it normally:

```ts
import { createBusinessAnalytics } from "@dreamplay/analytics/client";
```

The package has a `prepare` script, so Git installs build `dist/` during
installation.

Planned packages:

- `@dreamplay/email`
- `@dreamplay/shopify`

## Commands

```bash
pnpm install
pnpm build
pnpm typecheck
```
