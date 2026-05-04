# @dreamplay/emailer

Installable DreamPlay email engine helpers for business apps.

This package is extracted from `dreamplay-email-3`: agent-safe campaign and
subscriber APIs, a small human UI, Resend sending, email open/click tracking,
and `sid/cid` link attribution for `@dreamplay/analytics`.

## Quickstart

1. Install:

   ```bash
   pnpm add github:musical-basics/dreamplay-packages#path:/packages/emailer
   ```

2. Set server env vars:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_EMAIL_PROJECT.supabase.co
   SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY
   RESEND_API_KEY=YOUR_RESEND_KEY
   RESEND_FROM_EMAIL="DreamPlay <hello@email.dreamplaypianos.com>"
   AGENT_API_KEY=long-random-token
   NEXT_PUBLIC_APP_URL=https://your-business-site.com
   TRACKING_BASE_URL=https://your-business-site.com
   ```

3. Mount the agent API:

   ```ts
   import {
     createEmailAgentHandler,
     type EmailAgentRouteContext,
   } from "@dreamplay/emailer/agent-server";

   const handler = createEmailAgentHandler({
     allowedWorkspaces: ["concert_marketing"],
   });

   export function GET(request: Request, context: EmailAgentRouteContext) {
     return handler(request, context);
   }

   export function POST(request: Request, context: EmailAgentRouteContext) {
     return handler(request, context);
   }

   export function PATCH(request: Request, context: EmailAgentRouteContext) {
     return handler(request, context);
   }

   export function DELETE(request: Request, context: EmailAgentRouteContext) {
     return handler(request, context);
   }
   ```

   Suggested path:

   ```text
   app/api/emailer/agent/[workspace]/[...path]/route.ts
   ```

4. Mount the server-auth editor API for the human UI:

   ```ts
   import {
     createEmailEditorHandler,
     type EmailAgentRouteContext,
   } from "@dreamplay/emailer/agent-server";

   const handler = createEmailEditorHandler({
     allowedWorkspaces: ["concert_marketing"],
   });

   export const GET = (request: Request, context: EmailAgentRouteContext) =>
     handler(request, context);
   export const POST = (request: Request, context: EmailAgentRouteContext) =>
     handler(request, context);
   export const PATCH = (request: Request, context: EmailAgentRouteContext) =>
     handler(request, context);
   export const DELETE = (request: Request, context: EmailAgentRouteContext) =>
     handler(request, context);
   ```

   Suggested path:

   ```text
   app/api/emailer/editor/[workspace]/[...path]/route.ts
   ```

5. Mount the basic UI:

   ```tsx
   import { EmailerDashboard } from "@dreamplay/emailer/dashboard";

   export default function EmailerPage() {
     return (
       <EmailerDashboard
         title="Concert Emailer"
         initialWorkspace="concert_marketing"
         workspaces={["concert_marketing"]}
         apiBasePath="/api/emailer/editor"
       />
     );
   }
   ```

6. Mount tracking endpoints:

   ```ts
   import { createEmailOpenTrackingHandler } from "@dreamplay/emailer/tracking-server";

   export const GET = createEmailOpenTrackingHandler();
   ```

   ```ts
   import { createEmailClickTrackingHandler } from "@dreamplay/emailer/tracking-server";

   export const GET = createEmailClickTrackingHandler();
   ```

   Suggested paths:

   ```text
   app/api/track/open/route.ts
   app/api/track/click/route.ts
   ```

7. Verify:

   ```bash
   curl "$SITE/api/emailer/agent/concert_marketing/health" \
     -H "Authorization: Bearer $AGENT_API_KEY"
   ```

## What Installs

- `createEmailAgentHandler`: bearer-auth agent API for campaigns,
  subscribers, tags, clone, and send.
- `createEmailEditorHandler`: same API, but server-injects `AGENT_API_KEY` for
  same-origin UI calls.
- `EmailerDashboard`: lightweight campaign/subscriber UI.
- `sendEmailCampaign` and `createEmailSendHandler`: Resend delivery pipeline.
- `createEmailOpenTrackingHandler` and `createEmailClickTrackingHandler`:
  `subscriber_events` tracking endpoints.
- Subscribe helpers for public landing-page forms.

## Agent API

Base path:

```text
/api/emailer/agent/{workspace}/{resource}
```

Every request needs:

```http
Authorization: Bearer <AGENT_API_KEY>
```

Implemented resources:

```text
GET    /campaigns
GET    /campaigns/{id}
POST   /campaigns
PATCH  /campaigns/{id}
POST   /campaigns/{id}/clone
POST   /campaigns/{id}/send

GET    /subscribers
GET    /subscribers/{id}
POST   /subscribers
PATCH  /subscribers/{id}
POST   /subscribers/bulk-tag
POST   /subscribers/bulk-untag

GET    /tags
POST   /tags
DELETE /tags/{id}
```

List endpoints support `limit` and `offset`. Subscribers support `tag`,
repeatable `not_tag`, `status`, and `search`.

## Analytics Connection

The email package connects to `@dreamplay/analytics` by preserving email
attribution on destination links.

During sends, every absolute `href` gets:

```text
sid=<subscriber_id>
cid=<campaign_id>
```

The destination site should install `@dreamplay/analytics` and self-host
`/api/track`. The analytics client reads `sid/cid` from the URL and sends them
in metadata. The analytics track handler can then resolve `sid -> email`
server-side using the email Supabase project.

Default click tracking mode is `append`, not redirect. That means recipients
land directly on the destination URL and analytics owns click attribution via
pageviews. Use `clickTrackingMode: "redirect"` only for small sends where
server-side click rows in `subscriber_events` are more important than
deliverability.

## Subscribe Forms

The subscribe route writes directly to the installed emailer Supabase database
by default. It creates/updates a `subscribers` row, merges tags, auto-creates tag
definitions, and preserves `unsubscribed` status if the email already opted out.

```ts
import {
  createEmailSubscribeHandler,
  createEmailSubscribeOptionsHandler,
} from "@dreamplay/emailer/server";

const options = {
  workspace: "concert_marketing",
  defaultTags: ["belgium-concert-2026"],
} as const;

export const POST = createEmailSubscribeHandler(options);
export const OPTIONS = createEmailSubscribeOptionsHandler(options);
```

Suggested path:

```text
app/api/subscribe/route.ts
```

From the website:

```ts
await fetch("/api/subscribe", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email,
    first_name: firstName,
    gdpr_consent: true,
  }),
});
```

Only pass `endpoint` to `createEmailSubscribeHandler` if you intentionally want
to proxy to another emailer deployment instead of writing to this business DB.

## Database Expectations

This package expects the DreamPlay Email schema from `dreamplay-email-2` /
`dreamplay-email-3`, including these tables:

```text
campaigns
subscribers
tag_definitions
sent_history
subscriber_events
send_logs
```

At minimum, a business install must provide the same columns used by the
handlers. The next package hardening step should ship the canonical SQL
migration in `packages/emailer/supabase/`.

## Workspaces

Known workspace slugs:

```text
dreamplay_marketing
dreamplay_support
musicalbasics
crossover
concert_marketing
```

Use `allowedWorkspaces` in each business install to make accidental cross-business
sends impossible.
