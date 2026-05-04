import {
  buildSubscribePayload,
  createDreamplayEmailer,
  type EmailerConfig,
} from "./client.js";
import {
  createEmailSupabaseClient,
  type EmailEngineOptions,
} from "./database.js";
import {
  assertValidSubscribePayload,
  metadataFromHeaders,
  normalizeEmail,
  normalizeTags,
  type HeaderReader,
  type SubscribePayload,
  type SubscribeResponse,
} from "./schema.js";

export type CorsOptions = {
  allowedOrigins: string[];
  allowVercelPreviews?: boolean;
  allowLocalhost?: boolean;
  methods?: string;
  headers?: string;
};

export type EmailSubscribeHandlerOptions = EmailerConfig & EmailEngineOptions & {
  cors?: CorsOptions;
};

export async function subscribeWithHeaders(
  payload: SubscribePayload,
  headers: HeaderReader,
  options: EmailSubscribeHandlerOptions = {}
): Promise<SubscribeResponse> {
  const enriched = {
    ...payload,
    ...metadataFromHeaders(headers),
  };
  if (!options.endpoint) return subscribeToEmailerDatabase(enriched, options);
  return createDreamplayEmailer(options).subscribe(enriched);
}

export function createEmailSubscribeHandler(options: EmailSubscribeHandlerOptions = {}) {
  const emailer = options.endpoint ? createDreamplayEmailer(options) : null;

  return async function POST(request: Request): Promise<Response> {
    const headers = subscribeCorsHeaders(request, options);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400, headers });
    }

    if (!isRecord(body)) {
      return Response.json({ success: false, error: "Body must be an object" }, { status: 400, headers });
    }

    const payload = body as SubscribePayload;
    try {
      assertValidSubscribePayload(payload);
    } catch (error) {
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : "Invalid subscribe payload" },
        { status: 400, headers }
      );
    }

    const enriched = {
      ...payload,
      ...metadataFromHeaders(request.headers),
    };
    const result = emailer
      ? await emailer.subscribe(enriched)
      : await subscribeToEmailerDatabase(enriched, options);

    return Response.json(result, {
      status: result.success ? 200 : result.status ?? 502,
      headers,
    });
  };
}

export async function subscribeToEmailerDatabase(
  payload: SubscribePayload,
  options: EmailSubscribeHandlerOptions = {}
): Promise<SubscribeResponse> {
  const body = buildSubscribePayload(payload, options);
  const workspace = body.workspace ?? options.workspace;
  if (!workspace) return { success: false, error: "workspace is required" };

  const email = normalizeEmail(body.email);
  const tags = normalizeTags(body.tags);
  const supabase = createEmailSupabaseClient(options);

  try {
    await ensureTagDefinitions(workspace, tags, options);

    const existing = await supabase
      .from("subscribers")
      .select("id,tags,status")
      .eq("workspace", workspace)
      .eq("email", email)
      .maybeSingle();

    if (existing.error) {
      return { success: false, error: existing.error.message, status: 500 };
    }

    const existingTags = Array.isArray(existing.data?.tags) ? existing.data.tags : [];
    const record = stripUndefined({
      email,
      first_name: body.first_name ?? "",
      last_name: body.last_name ?? "",
      tags: normalizeTags([...existingTags, ...tags]),
      workspace,
      city: body.city,
      country: body.country,
      ip_address: body.ip_address,
      gdpr_consent: body.gdpr_consent,
      consent_timestamp: body.gdpr_consent ? new Date().toISOString() : undefined,
      temp_session_id: body.temp_session_id,
      metadata: body.metadata,
      status: existing.data?.status === "unsubscribed" ? "unsubscribed" : "active",
    });

    const result = existing.data?.id
      ? await supabase
          .from("subscribers")
          .update(record)
          .eq("id", existing.data.id)
          .select("id")
          .single()
      : await supabase
          .from("subscribers")
          .insert(record)
          .select("id")
          .single();

    if (result.error) return { success: false, error: result.error.message, status: 500 };

    return {
      success: true,
      id: result.data?.id,
      status: existing.data?.id ? 200 : 201,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to subscribe",
    };
  }
}

export function createEmailSubscribeOptionsHandler(options: EmailSubscribeHandlerOptions = {}) {
  return async function OPTIONS(request: Request): Promise<Response> {
    return new Response(null, {
      status: 200,
      headers: subscribeCorsHeaders(request, options),
    });
  };
}

function subscribeCorsHeaders(
  request: Request,
  options: EmailSubscribeHandlerOptions
): Record<string, string> {
  if (!options.cors) return {};
  return corsHeaders(request.headers.get("origin"), options.cors);
}

export function corsHeaders(origin: string | null, options: CorsOptions): Record<string, string> {
  if (!isAllowedOrigin(origin, options)) return {};
  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Methods": options.methods ?? "POST, OPTIONS",
    "Access-Control-Allow-Headers": options.headers ?? "Content-Type, Authorization",
  };
}

export function isAllowedOrigin(origin: string | null, options: CorsOptions): boolean {
  if (!origin) return false;
  if (options.allowedOrigins.includes(origin)) return true;
  if (options.allowVercelPreviews && origin.endsWith(".vercel.app")) return true;
  if (options.allowLocalhost && origin.includes("localhost")) return true;
  return false;
}

async function ensureTagDefinitions(
  workspace: string,
  tags: string[],
  options: EmailSubscribeHandlerOptions
): Promise<void> {
  if (!tags.length) return;
  const supabase = createEmailSupabaseClient(options);
  await supabase.from("tag_definitions").upsert(
    tags.map((name) => ({ name, color: "#6b7280", workspace })),
    { onConflict: "name,workspace" }
  );
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
