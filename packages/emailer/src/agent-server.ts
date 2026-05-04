import { z, type ZodError } from "zod";
import {
  createEmailSupabaseClient,
  emailError,
  emailJson,
  readJson,
  requireAgentAuth,
  type EmailEngineOptions,
} from "./database.js";
import { sendEmailCampaign, type SendEmailCampaignOptions } from "./send-server.js";
import {
  EMAIL_WORKSPACES,
  normalizeEmail,
  normalizeTags,
  type EmailWorkspace,
  type JsonObject,
} from "./schema.js";

export type EmailAgentRouteContext = {
  params: Promise<{ workspace: string; path?: string[] }>;
};

export type EmailAgentHandlerOptions = SendEmailCampaignOptions & {
  allowedWorkspaces?: readonly string[];
  dispatchSendEvent?: (event: {
    name: string;
    data: Record<string, unknown>;
  }) => Promise<unknown>;
};

const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)])
);
const jsonObjectSchema = z.record(jsonValue);

const campaignCreateSchema = z.object({
  name: z.string().min(1),
  subject_line: z.string().optional().nullable(),
  html_content: z.string().optional().nullable(),
  variable_values: jsonObjectSchema.optional(),
  status: z.enum(["draft", "scheduled", "sending", "completed", "deleted"]).optional(),
  email_type: z.enum(["campaign", "automated"]).optional().default("campaign"),
  is_template: z.boolean().optional(),
  is_ready: z.boolean().optional(),
  is_starred_template: z.boolean().optional(),
  parent_template_id: z.string().uuid().optional().nullable(),
  category: z.string().optional().nullable(),
  template_folder_id: z.string().uuid().optional().nullable(),
  sent_from_email: z.string().email().optional().nullable(),
});

const campaignPatchSchema = campaignCreateSchema.partial().omit({ name: true }).extend({
  name: z.string().min(1).optional(),
});

const cloneCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  subscriber_ids: z.array(z.string().uuid()).optional(),
  target_tag: z.string().min(1).optional(),
  variable_values: jsonObjectSchema.optional(),
  is_template: z.boolean().optional(),
  is_starred_template: z.boolean().optional(),
});

const sendSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  confirmTargetTag: z.boolean().optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().email().optional(),
  clickTracking: z.boolean().optional(),
  clickTrackingMode: z.enum(["append", "redirect"]).optional(),
  openTracking: z.boolean().optional(),
  resendClickTracking: z.boolean().optional(),
  resendOpenTracking: z.boolean().optional(),
});

const subscriberUpsertSchema = z.object({
  email: z.string().email(),
  first_name: z.string().optional().default(""),
  last_name: z.string().optional().default(""),
  status: z.enum(["active", "unsubscribed", "bounced", "deleted"]).optional(),
  tags: z.array(z.string().min(1)).optional().default([]),
  smart_tags: jsonObjectSchema.optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
  phone_code: z.string().optional(),
  phone_number: z.string().optional(),
  shipping_address1: z.string().optional(),
  shipping_address2: z.string().optional(),
  shipping_city: z.string().optional(),
  shipping_zip: z.string().optional(),
  shipping_province: z.string().optional(),
  shopify_customer_id: z.string().optional(),
  klaviyo_profile_id: z.string().optional(),
});

const subscriberPatchSchema = subscriberUpsertSchema.partial().omit({
  email: true,
  tags: true,
});

const bulkTagSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(500),
  tags: z.array(z.string().min(1)).min(1).max(50),
});

const tagCreateSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1).optional().default("#6b7280"),
});

const campaignListFields = [
  "id",
  "name",
  "subject_line",
  "status",
  "email_type",
  "is_template",
  "is_ready",
  "is_starred_template",
  "parent_template_id",
  "category",
  "total_recipients",
  "total_opens",
  "total_clicks",
  "scheduled_at",
  "scheduled_status",
  "workspace",
  "created_at",
  "updated_at",
].join(",");
const campaignDetailFields = `${campaignListFields},html_content,variable_values,sent_from_email`;

export function createEmailAgentHandler(options: EmailAgentHandlerOptions = {}) {
  return async function handleEmailAgentRequest(
    request: Request,
    context: EmailAgentRouteContext
  ): Promise<Response> {
    try {
      const authError = requireAgentAuth(request, options);
      if (authError) return authError;

      const params = await context.params;
      const workspace = parseWorkspace(params.workspace, options);
      if (!workspace) {
        return emailError("Invalid workspace", 400, { allowed: allowedWorkspaces(options) });
      }

      const path = params.path ?? [];
      const resource = path[0] ?? "";
      const method = request.method.toUpperCase();

      switch (resource) {
        case "campaigns":
          return handleCampaigns(request, method, workspace, path, options);
        case "subscribers":
          return handleSubscribers(request, method, workspace, path, options);
        case "tags":
          return handleTags(request, method, workspace, path, options);
        case "health":
          return emailJson({ ok: true, service: "@dreamplay/emailer", workspace });
        default:
          return emailError(`Unknown email agent resource: ${resource}`, 404);
      }
    } catch (error) {
      console.error("[@dreamplay/emailer agent] unhandled error:", error);
      return emailError(error instanceof Error ? error.message : "Unexpected server error", 500);
    }
  };
}

export function createEmailEditorHandler(options: EmailAgentHandlerOptions = {}) {
  const agentHandler = createEmailAgentHandler(options);
  return async function handleEmailEditorRequest(
    request: Request,
    context: EmailAgentRouteContext
  ): Promise<Response> {
    const key = options.agentApiKey ?? process.env.AGENT_API_KEY;
    if (!key) return emailError("AGENT_API_KEY is not configured", 503);

    const headers = new Headers(request.headers);
    headers.set("authorization", `Bearer ${key}`);
    const init: RequestInit = { method: request.method, headers };
    if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
      init.body = await request.arrayBuffer();
    }
    return agentHandler(new Request(request.url, init), context);
  };
}

async function handleCampaigns(
  request: Request,
  method: string,
  workspace: EmailWorkspace,
  path: string[],
  options: EmailAgentHandlerOptions
): Promise<Response> {
  const supabase = createEmailSupabaseClient(options);
  const campaignId = path[1];
  const action = path[2];

  if (method === "GET" && !campaignId) {
    const url = new URL(request.url);
    const pagination = paginationFromUrl(url);
    const [from, to] = rangeFor(pagination);
    const includeHtml = url.searchParams.get("include_html") === "true";
    let query = supabase
      .from("campaigns")
      .select(includeHtml ? campaignDetailFields : campaignListFields, { count: "exact" })
      .eq("workspace", workspace)
      .order("updated_at", { ascending: false })
      .range(from, to);

    for (const [param, column] of [
      ["status", "status"],
      ["email_type", "email_type"],
      ["parent_template_id", "parent_template_id"],
    ] as const) {
      const value = url.searchParams.get(param);
      if (value) query = query.eq(column, value);
    }
    const isTemplate = url.searchParams.get("is_template");
    if (isTemplate !== null) query = query.eq("is_template", isTemplate === "true");

    const { data, count, error } = await query;
    if (error) return emailError(error.message, 500);
    return emailJson(listEnvelope(data, pagination, count));
  }

  if (method === "GET" && campaignId && !action) {
    const { data, error } = await supabase
      .from("campaigns")
      .select(campaignDetailFields)
      .eq("workspace", workspace)
      .eq("id", campaignId)
      .maybeSingle();
    if (error) return emailError(error.message, 500);
    if (!data) return emailError("Campaign not found", 404);
    return emailJson({ data });
  }

  if (method === "POST" && !campaignId) {
    const parsed = campaignCreateSchema.safeParse(await readJson(request));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { data, error } = await supabase
      .from("campaigns")
      .insert({ ...parsed.data, workspace })
      .select("*")
      .single();
    if (error) return emailError(error.message, 500);
    return emailJson({ data }, 201);
  }

  if (method === "PATCH" && campaignId && !action) {
    const parsed = campaignPatchSchema.safeParse(await readJson(request));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { data, error } = await supabase
      .from("campaigns")
      .update(parsed.data)
      .eq("workspace", workspace)
      .eq("id", campaignId)
      .select("*")
      .single();
    if (error) return emailError(error.message, 500);
    return emailJson({ data });
  }

  if (method === "POST" && campaignId && action === "clone") {
    const parsed = cloneCampaignSchema.safeParse(await readJson(request));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { data: source, error: sourceError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("workspace", workspace)
      .eq("id", campaignId)
      .maybeSingle();
    if (sourceError) return emailError(sourceError.message, 500);
    if (!source) return emailError("Campaign not found", 404);

    const sourceVars = asJsonObject((source as { variable_values?: JsonObject }).variable_values);
    const variableValues = {
      ...stripSubscriberTargeting(sourceVars),
      ...(parsed.data.target_tag ? { target_tag: parsed.data.target_tag } : {}),
      ...(parsed.data.subscriber_ids ? { subscriber_ids: parsed.data.subscriber_ids } : {}),
      ...(parsed.data.variable_values ?? {}),
    };
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        name: parsed.data.name ?? `${(source as { name?: string }).name ?? "Campaign"} (Clone ${new Date().toLocaleDateString()})`,
        subject_line: (source as { subject_line?: string | null }).subject_line,
        html_content: (source as { html_content?: string | null }).html_content,
        status: "draft",
        is_template: parsed.data.is_template ?? false,
        is_starred_template: parsed.data.is_starred_template ?? false,
        parent_template_id: campaignId,
        workspace,
        email_type: (source as { email_type?: string | null }).email_type || "campaign",
        variable_values: variableValues,
      })
      .select("*")
      .single();
    if (error) return emailError(error.message, 500);
    return emailJson({ data }, 201);
  }

  if (method === "POST" && campaignId && action === "send") {
    const parsed = sendSchema.safeParse(await readJson(request));
    if (!parsed.success) return zodErrorResponse(parsed.error);

    if (parsed.data.scheduledAt) {
      if (!options.dispatchSendEvent) {
        return emailError("scheduledAt requires dispatchSendEvent in package options", 501);
      }
      await options.dispatchSendEvent({
        name: "email.campaign.scheduled-send",
        data: { campaignId, ...parsed.data },
      });
      return emailJson({ data: { success: true, scheduled: true, scheduledAt: parsed.data.scheduledAt } });
    }

    const result = await sendEmailCampaign({ campaignId, ...parsed.data, sync: true }, options);
    return emailJson({ data: result }, result.done ? 200 : 500);
  }

  return emailError("Campaign endpoint not found", 404);
}

async function handleSubscribers(
  request: Request,
  method: string,
  workspace: EmailWorkspace,
  path: string[],
  options: EmailEngineOptions
): Promise<Response> {
  const supabase = createEmailSupabaseClient(options);
  const subscriberId = path[1];
  const action = path[2];

  if (method === "GET" && !subscriberId) {
    const url = new URL(request.url);
    const pagination = paginationFromUrl(url);
    const [from, to] = rangeFor(pagination);
    let query = supabase
      .from("subscribers")
      .select("*", { count: "exact" })
      .eq("workspace", workspace)
      .order("created_at", { ascending: false })
      .range(from, to);

    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");
    const tag = url.searchParams.get("tag");
    const notTags = url.searchParams.getAll("not_tag");
    if (status) query = query.eq("status", status);
    if (search) query = query.ilike("email", `%${search}%`);
    if (tag) query = query.contains("tags", [tag]);
    for (const notTag of notTags) query = query.not("tags", "cs", `{${notTag}}`);

    const { data, count, error } = await query;
    if (error) return emailError(error.message, 500);
    return emailJson(listEnvelope(data, pagination, count));
  }

  if (method === "GET" && subscriberId && !action) {
    const { data, error } = await supabase
      .from("subscribers")
      .select("*")
      .eq("workspace", workspace)
      .eq("id", subscriberId)
      .maybeSingle();
    if (error) return emailError(error.message, 500);
    if (!data) return emailError("Subscriber not found", 404);
    return emailJson({ data });
  }

  if (method === "POST" && !subscriberId) {
    const parsed = subscriberUpsertSchema.safeParse(await readJson(request));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const email = normalizeEmail(parsed.data.email);
    const tags = normalizeTags(parsed.data.tags);
    await ensureTagDefinitions(workspace, tags, options);

    const existing = await supabase
      .from("subscribers")
      .select("id,tags,status")
      .eq("workspace", workspace)
      .eq("email", email)
      .maybeSingle();
    if (existing.error) return emailError(existing.error.message, 500);

    const nextTags = normalizeTags([
      ...(((existing.data as { tags?: string[] } | null)?.tags ?? [])),
      ...tags,
    ]);
    const record = {
      ...parsed.data,
      email,
      tags: nextTags,
      workspace,
      status: (existing.data as { status?: string } | null)?.status === "unsubscribed"
        ? "unsubscribed"
        : parsed.data.status ?? "active",
    };

    const result = existing.data
      ? await supabase.from("subscribers").update(record).eq("id", (existing.data as { id: string }).id).select("*").single()
      : await supabase.from("subscribers").insert(record).select("*").single();
    if (result.error) return emailError(result.error.message, 500);
    return emailJson({ data: result.data }, existing.data ? 200 : 201);
  }

  if (method === "PATCH" && subscriberId && !action) {
    const parsed = subscriberPatchSchema.safeParse(await readJson(request));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { data, error } = await supabase
      .from("subscribers")
      .update(parsed.data)
      .eq("workspace", workspace)
      .eq("id", subscriberId)
      .select("*")
      .single();
    if (error) return emailError(error.message, 500);
    return emailJson({ data });
  }

  if (method === "POST" && subscriberId === "bulk-tag") {
    return bulkTag(request, workspace, options, true);
  }

  if (method === "POST" && subscriberId === "bulk-untag") {
    return bulkTag(request, workspace, options, false);
  }

  return emailError("Subscriber endpoint not found", 404);
}

async function handleTags(
  request: Request,
  method: string,
  workspace: EmailWorkspace,
  path: string[],
  options: EmailEngineOptions
): Promise<Response> {
  const supabase = createEmailSupabaseClient(options);
  const tagId = path[1];

  if (method === "GET" && !tagId) {
    const { data, error } = await supabase
      .from("tag_definitions")
      .select("*")
      .eq("workspace", workspace)
      .order("name");
    if (error) return emailError(error.message, 500);
    return emailJson({ data: data ?? [] });
  }

  if (method === "POST" && !tagId) {
    const parsed = tagCreateSchema.safeParse(await readJson(request));
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { data, error } = await supabase
      .from("tag_definitions")
      .upsert({ ...parsed.data, workspace }, { onConflict: "name,workspace" })
      .select("*")
      .single();
    if (error) return emailError(error.message, 500);
    return emailJson({ data }, 201);
  }

  if (method === "DELETE" && tagId) {
    const { error } = await supabase
      .from("tag_definitions")
      .delete()
      .eq("workspace", workspace)
      .eq("id", tagId);
    if (error) return emailError(error.message, 500);
    return emailJson({ data: { success: true } });
  }

  return emailError("Tag endpoint not found", 404);
}

async function bulkTag(
  request: Request,
  workspace: EmailWorkspace,
  options: EmailEngineOptions,
  add: boolean
): Promise<Response> {
  const parsed = bulkTagSchema.safeParse(await readJson(request));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const supabase = createEmailSupabaseClient(options);
  const emails = parsed.data.emails.map(normalizeEmail);
  const tags = normalizeTags(parsed.data.tags);
  if (add) await ensureTagDefinitions(workspace, tags, options);

  const { data, error } = await supabase
    .from("subscribers")
    .select("id,email,tags")
    .eq("workspace", workspace)
    .in("email", emails);
  if (error) return emailError(error.message, 500);

  let updated = 0;
  for (const subscriber of (data ?? []) as Array<{ id: string; tags?: string[] | null }>) {
    const current = subscriber.tags ?? [];
    const next = add
      ? normalizeTags([...current, ...tags])
      : current.filter((tag) => !tags.includes(tag));
    const res = await supabase.from("subscribers").update({ tags: next }).eq("id", subscriber.id);
    if (!res.error) updated++;
  }

  return emailJson({ data: { success: true, matched: data?.length ?? 0, updated } });
}

async function ensureTagDefinitions(
  workspace: EmailWorkspace,
  tags: string[],
  options: EmailEngineOptions
): Promise<void> {
  const cleanTags = normalizeTags(tags);
  if (!cleanTags.length) return;
  const supabase = createEmailSupabaseClient(options);
  const records = cleanTags.map((name) => ({ name, color: "#6b7280", workspace }));
  await supabase.from("tag_definitions").upsert(records, { onConflict: "name,workspace" });
}

function zodErrorResponse(error: ZodError): Response {
  return emailError("VALIDATION_ERROR", 422, error.flatten());
}

function paginationFromUrl(url: URL): { limit: number; offset: number } {
  return {
    limit: Math.min(Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25, 500),
    offset: Math.max(Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0),
  };
}

function rangeFor(pagination: { limit: number; offset: number }): [number, number] {
  return [pagination.offset, pagination.offset + pagination.limit - 1];
}

function listEnvelope(data: unknown, pagination: { limit: number; offset: number }, count: number | null) {
  return { data: data ?? [], pagination: { ...pagination, count: count ?? 0 } };
}

function parseWorkspace(value: string, options: EmailAgentHandlerOptions): EmailWorkspace | null {
  return allowedWorkspaces(options).includes(value) ? (value as EmailWorkspace) : null;
}

function allowedWorkspaces(options: EmailAgentHandlerOptions): readonly string[] {
  return options.allowedWorkspaces ?? EMAIL_WORKSPACES;
}

function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function stripSubscriberTargeting(value: JsonObject): JsonObject {
  const { subscriber_id: _subscriberId, subscriber_ids: _subscriberIds, ...rest } = value;
  return rest;
}
