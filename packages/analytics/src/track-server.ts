import { createClient } from "@supabase/supabase-js";
import {
  analyticsSchemaForBusiness,
  parseBusinessAnalyticsEvent,
  type Business,
  type BusinessAnalyticsEvent,
} from "./schema.js";

export type CorsOptions = {
  allowedOrigins: string[];
  allowVercelPreviews?: boolean;
  allowLocalhost?: boolean;
  methods?: string;
  headers?: string;
};

export type BusinessAnalyticsTrackHandlerOptions = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  business: Business;
  schema?: string;
  tableName?: string;
  cors?: CorsOptions;
  ignoreLikelyBotUserAgent?: boolean;
  emailSupabaseUrl?: string;
  emailSupabaseServiceRoleKey?: string;
  emailSubscribersTable?: string;
};

export function createBusinessAnalyticsTrackHandler(
  options: BusinessAnalyticsTrackHandlerOptions
) {
  return async function POST(request: Request): Promise<Response> {
    const headers = trackCorsHeaders(request, options);
    const userAgent = request.headers.get("user-agent");

    if (options.ignoreLikelyBotUserAgent && isLikelyBotUserAgent(userAgent)) {
      return Response.json({ ignored: true, reason: "likely_bot_user_agent" }, { headers });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers });
    }

    const parsed = parseBusinessAnalyticsEvent(rawBody);
    if (!parsed.ok) {
      return Response.json({ errors: parsed.errors }, { status: 400, headers });
    }

    const event = parsed.event;
    if (event.metadata.business !== options.business) {
      return Response.json(
        {
          error: "Analytics event business does not match ingestion route business",
          expected: options.business,
          received: event.metadata.business,
        },
        { status: 400, headers }
      );
    }

    const schema = options.schema ?? analyticsSchemaForBusiness(options.business);
    if (!schema) {
      return Response.json({ error: "Unknown analytics business schema" }, { status: 400, headers });
    }

    const metadata = await enrichMetadataFromSubscriberId(event, options);
    const supabase = createClient(options.supabaseUrl, options.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const { error } = await supabase
      .schema(schema)
      .from(options.tableName ?? "analytics_logs")
      .insert({
        event_name: event.event_name,
        path: event.path.slice(0, 2000),
        session_id: event.session_id,
        anonymous_id: event.anonymous_id,
        tracker_version: event.tracker_version,
        metadata: {
          ...metadata,
          ...(request.headers.get("x-vercel-ip-city")
            ? { city: request.headers.get("x-vercel-ip-city") }
            : {}),
          ...(request.headers.get("x-vercel-ip-country-region")
            ? { region: request.headers.get("x-vercel-ip-country-region") }
            : {}),
        },
        ip_address: resolveClientIp(request.headers),
        user_agent: userAgent,
        country: request.headers.get("x-vercel-ip-country"),
        city: request.headers.get("x-vercel-ip-city"),
        region: request.headers.get("x-vercel-ip-country-region"),
      });

    if (error) {
      return Response.json({ error: error.message }, { status: 500, headers });
    }

    return Response.json({ success: true }, { headers });
  };
}

export function createBusinessAnalyticsTrackOptionsHandler(
  options: BusinessAnalyticsTrackHandlerOptions
) {
  return async function OPTIONS(request: Request): Promise<Response> {
    return new Response(null, {
      status: 200,
      headers: trackCorsHeaders(request, options),
    });
  };
}

async function enrichMetadataFromSubscriberId(
  event: BusinessAnalyticsEvent,
  options: BusinessAnalyticsTrackHandlerOptions
) {
  const metadata: Record<string, unknown> = { ...event.metadata };
  if (
    !options.emailSupabaseUrl ||
    !options.emailSupabaseServiceRoleKey ||
    typeof metadata.sid !== "string" ||
    metadata.sid.length === 0 ||
    typeof metadata.email === "string"
  ) {
    return metadata;
  }

  try {
    const emailSupabase = createClient(
      options.emailSupabaseUrl,
      options.emailSupabaseServiceRoleKey,
      { auth: { persistSession: false } }
    );
    const { data } = await emailSupabase
      .from(options.emailSubscribersTable ?? "subscribers")
      .select("email")
      .eq("id", metadata.sid)
      .maybeSingle();

    const email = (data as { email?: unknown } | null)?.email;
    if (typeof email === "string" && email.length > 0) {
      metadata.email = email;
    }
  } catch {
    return metadata;
  }

  return metadata;
}

function trackCorsHeaders(
  request: Request,
  options: BusinessAnalyticsTrackHandlerOptions
): Record<string, string> {
  if (!options.cors) return {};
  return corsHeaders(request.headers.get("origin"), options.cors);
}

function resolveClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") || "unknown";
}

function isLikelyBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return /bot|spider|crawl|headless|lighthouse|pingdom/i.test(userAgent);
}

function corsHeaders(origin: string | null, options: CorsOptions): Record<string, string> {
  if (!isAllowedOrigin(origin, options)) return {};
  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Methods": options.methods ?? "POST, OPTIONS",
    "Access-Control-Allow-Headers": options.headers ?? "Content-Type, Authorization",
  };
}

function isAllowedOrigin(origin: string | null, options: CorsOptions): boolean {
  if (!origin) return false;
  if (options.allowedOrigins.includes(origin)) return true;
  if (options.allowVercelPreviews && origin.endsWith(".vercel.app")) return true;
  if (options.allowLocalhost && origin.includes("localhost")) return true;
  return false;
}
