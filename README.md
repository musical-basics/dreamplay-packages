# DreamPlay Packages

Shared packages used by the business repos.

Current package:

- `@dreamplay/analytics` - browser-side event tracker and shared analytics helpers
  - includes Supabase Option B setup SQL at
    `packages/analytics/supabase/001_business_analytics_schemas.sql`
  - includes shared visit classification for scanner-likely vs human-likely
    email-attributed visits

## Install From GitHub

Install only the analytics package subdirectory:

```bash
pnpm add "github:musical-basics/dreamplay-packages#path:/packages/analytics"
```

Then import it normally:

```ts
import { createBusinessAnalytics } from "@dreamplay/analytics/client";
```

The analytics package commits its built `dist/` output so Git installs do not
need to run package build scripts.

To pull a newer commit into a business repo later:

```bash
pnpm update @dreamplay/analytics
```

Planned packages:

- `@dreamplay/email`
- `@dreamplay/shopify`

## Commands

```bash
pnpm install
pnpm build
pnpm typecheck
```
