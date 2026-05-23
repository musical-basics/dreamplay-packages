import { createClient } from "@supabase/supabase-js";
import { classifyVisit } from "./classification.js";
import { analyticsSchemaForBusiness, asString, type Business } from "./schema.js";
import {
  createAnalyticsSchemaExposureChecker,
  isAnalyticsSchemaNotExposedError,
  type SchemaExposureCheckClient,
} from "./schema-check.js";
import type {
  AnalyticsChartPoint,
  AnalyticsDashboardData,
  AnalyticsDashboardRange,
  AnalyticsEmailVisitorData,
  AnalyticsEventRow,
  AnalyticsVisitorHistory,
  AnalyticsVisitorSummary,
} from "./dashboard-types.js";

export type AnalyticsDashboardServerOptions = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  business?: Business;
  schema?: string;
  tableName?: string;
  ipEmailMapTableName?: string;
  adminIps?: string[];
  maxLogs?: number;
};

type Supabase = ReturnType<typeof createClient>;
type LooseSupabase = {
  schema: (schema: string) => { from: (table: string) => any };
  from: (table: string) => any;
};

type QueryParams = {
  range: AnalyticsDashboardRange;
  excludeAdmin: boolean;
  excludeBots: boolean;
  visitorLimit: number;
  tz?: string;
};

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  Pragma: "no-cache",
  Expires: "0",
};

export function createAnalyticsDashboardStatsHandler(options: AnalyticsDashboardServerOptions) {
  const ensureSchemaExposed = createDashboardSchemaExposureChecker(options);

  return async function GET(request: Request): Promise<Response> {
    try {
      await ensureDashboardSchemaExposed(ensureSchemaExposed, options);
      const params = parseDashboardQuery(request);
      const data = await getAnalyticsDashboardData(options, params);
      return json(data);
    } catch (error) {
      return dashboardErrorResponse("stats", "Failed to fetch analytics stats", error);
    }
  };
}

export function createAnalyticsDashboardVisitorHistoryHandler(
  options: AnalyticsDashboardServerOptions
) {
  const ensureSchemaExposed = createDashboardSchemaExposureChecker(options);

  return async function GET(request: Request): Promise<Response> {
    try {
      await ensureDashboardSchemaExposed(ensureSchemaExposed, options);
      const url = new URL(request.url);
      const ip = url.searchParams.get("ip");
      const visitorKey = url.searchParams.get("visitor_key");
      if (!ip && !visitorKey) return json({ error: "Missing ip or visitor_key" }, 400);

      const params = parseDashboardQuery(request);
      const history = await getAnalyticsVisitorHistory(options, {
        range: params.range,
        excludeAdmin: params.excludeAdmin,
        excludeBots: params.excludeBots,
        ip: ip ?? undefined,
        visitorKey: visitorKey ?? undefined,
      });
      return json(history);
    } catch (error) {
      return dashboardErrorResponse("visitor history", "Failed to fetch visitor history", error);
    }
  };
}

export function createAnalyticsDashboardEmailVisitorsHandler(
  options: AnalyticsDashboardServerOptions
) {
  const ensureSchemaExposed = createDashboardSchemaExposureChecker(options);

  return async function GET(request: Request): Promise<Response> {
    try {
      await ensureDashboardSchemaExposed(ensureSchemaExposed, options);
      const params = parseDashboardQuery(request);
      const data = await getAnalyticsEmailVisitors(options, params);
      return json(data);
    } catch (error) {
      return dashboardErrorResponse("email visitors", "Failed to fetch email visitors", error);
    }
  };
}

export async function getAnalyticsDashboardData(
  options: AnalyticsDashboardServerOptions,
  params: Partial<QueryParams> = {}
): Promise<AnalyticsDashboardData> {
  const merged = withDefaultParams(params);
  const supabase = createDashboardSupabaseClient(options);
  const logs = await fetchAnalyticsLogs(supabase, options, merged.range, merged.visitorLimit);
  const filteredLogs = filterLogs(logs, options, merged.excludeAdmin, merged.excludeBots);
  const pageviews = filteredLogs.filter((log) => log.event_name === "pageview");
  const visitorStats = await buildVisitorStats(supabase, options, filteredLogs);
  const chartData = buildChartData(filteredLogs, merged.range, merged.tz);

  return {
    liveUsers: countLiveUsers(filteredLogs),
    totalPageviews: pageviews.length,
    uniqueVisitors: uniqueVisitorIds(filteredLogs).size,
    uniquePages: new Set(pageviews.map((log) => log.path)).size,
    chartData,
    recentEvents: filteredLogs.slice(0, 50),
    abResults: buildAbResults(filteredLogs),
    visitorStats,
  };
}

export async function getAnalyticsEmailVisitors(
  options: AnalyticsDashboardServerOptions,
  params: Partial<QueryParams> = {}
): Promise<AnalyticsEmailVisitorData> {
  const data = await getAnalyticsDashboardData(options, params);
  return {
    emailVisitorStats: data.visitorStats.filter((visitor) => {
      return Boolean(visitor.email || visitor.sid || visitor.cid || visitor.classification?.emailAttributed);
    }),
  };
}

export async function getAnalyticsVisitorHistory(
  options: AnalyticsDashboardServerOptions,
  params: {
    range?: AnalyticsDashboardRange;
    excludeAdmin?: boolean;
    excludeBots?: boolean;
    ip?: string;
    visitorKey?: string;
  }
): Promise<AnalyticsVisitorHistory> {
  const supabase = createDashboardSupabaseClient(options);
  const range = params.range ?? "7d";
  const logs = await fetchAnalyticsLogs(supabase, options, range, options.maxLogs ?? 5000);
  const filteredLogs = filterLogs(
    logs,
    options,
    params.excludeAdmin ?? true,
    params.excludeBots ?? true
  ).filter((log) => {
    const key = visitorKeyForLog(log);
    return params.visitorKey ? key === params.visitorKey : log.ip_address === params.ip;
  });

  const ordered = [...filteredLogs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const pageviews = ordered.filter((log) => log.event_name === "pageview");
  const leaves = ordered.filter((log) => log.event_name === "page_leave");
  const visits = pageviews.map((pageview, index) => {
    const pageviewAt = new Date(pageview.created_at).getTime();
    const nextPageviewAt =
      index < pageviews.length - 1
        ? new Date(pageviews[index + 1]!.created_at).getTime()
        : Number.POSITIVE_INFINITY;
    const leave = leaves.find((event) => {
      const leaveAt = new Date(event.created_at).getTime();
      return event.path === pageview.path && leaveAt >= pageviewAt && leaveAt < nextPageviewAt;
    });
    const durationSeconds =
      numberFromMetadata(leave?.metadata, "duration_seconds") ??
      (Number.isFinite(nextPageviewAt) ? Math.round((nextPageviewAt - pageviewAt) / 1000) : null);
    return {
      path: pageview.path,
      visited_at: pageview.created_at,
      duration_seconds:
        durationSeconds !== null && durationSeconds > 7200 ? null : durationSeconds,
      metadata: pageview.metadata ?? null,
    };
  });
  const geoSource = [...ordered]
    .reverse()
    .find((log) => log.country || log.city || log.region || log.metadata?.city);

  return {
    visits,
    total_pageviews: pageviews.length,
    first_seen: pageviews[0]?.created_at ?? null,
    last_seen: pageviews[pageviews.length - 1]?.created_at ?? null,
    geo: {
      country: geoSource?.country ?? null,
      city: geoSource?.city ?? asString(geoSource?.metadata?.city) ?? null,
      region: geoSource?.region ?? asString(geoSource?.metadata?.region) ?? null,
    },
    classification: classifyLogs(ordered),
  };
}

export function createDashboardSupabaseClient(
  options: AnalyticsDashboardServerOptions
): Supabase {
  return createClient(options.supabaseUrl, options.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

async function fetchAnalyticsLogs(
  supabase: Supabase,
  options: AnalyticsDashboardServerOptions,
  range: AnalyticsDashboardRange,
  limit: number
): Promise<AnalyticsEventRow[]> {
  let query = analyticsTable(supabase, options)
    .select(
      "id, created_at, event_name, path, ip_address, country, city, region, session_id, anonymous_id, tracker_version, user_agent, metadata"
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, options.maxLogs ?? 5000));

  const start = rangeStart(range);
  if (start) query = query.gte("created_at", start.toISOString());

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AnalyticsEventRow[];
}

async function buildVisitorStats(
  supabase: Supabase,
  options: AnalyticsDashboardServerOptions,
  logs: AnalyticsEventRow[]
): Promise<AnalyticsVisitorSummary[]> {
  const ipEmailMap = await fetchIpEmailMap(supabase, options);
  const grouped = new Map<string, AnalyticsEventRow[]>();

  for (const log of logs) {
    const key = visitorKeyForLog(log);
    const group = grouped.get(key) ?? [];
    group.push(log);
    grouped.set(key, group);
  }

  return Array.from(grouped.entries())
    .map(([visitorKey, visitorLogs]) => {
      const newest = visitorLogs[0]!;
      const oldestSource = [...visitorLogs].reverse().find(sourceForLog);
      const pageviews = visitorLogs.filter((log) => log.event_name === "pageview");
      const email =
        firstMetadataString(visitorLogs, "email") ??
        (newest.ip_address ? ipEmailMap.get(newest.ip_address) : undefined);
      const sid = firstMetadataString(visitorLogs, "sid");
      const cid = firstMetadataString(visitorLogs, "cid");
      const variant = firstMetadataString(visitorLogs, "ab_variant");
      return {
        visitorKey,
        ip: newest.ip_address ?? "unknown",
        count: pageviews.length,
        lastPath: newest.path,
        lastSeen: newest.created_at,
        country: newest.country ?? "Unknown",
        city: newest.city ?? asString(newest.metadata?.city) ?? null,
        region: newest.region ?? asString(newest.metadata?.region) ?? null,
        device: deviceFromUserAgent(newest.user_agent),
        email,
        sid,
        cid,
        variant,
        source: oldestSource ? sourceForLog(oldestSource) : undefined,
        sourceUrl: sourceUrlForLog(oldestSource),
        totalTimeSeconds: totalDurationSeconds(visitorLogs),
        journey_id: firstMetadataString(visitorLogs, "journey_id"),
        classification: classifyLogs(visitorLogs),
      } satisfies AnalyticsVisitorSummary;
    })
    .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
}

async function fetchIpEmailMap(
  supabase: Supabase,
  options: AnalyticsDashboardServerOptions
): Promise<Map<string, string>> {
  const tableName = options.ipEmailMapTableName ?? "ip_email_map";
  const schema = analyticsSchema(options);
  const map = new Map<string, string>();
  const { data, error } = await analyticsTableByName(supabase, schema, tableName).select(
    "ip_address, email"
  );

  if (error) return map;
  for (const row of data ?? []) {
    const ip = asString((row as Record<string, unknown>).ip_address);
    const email = asString((row as Record<string, unknown>).email);
    if (ip && email) map.set(ip, email);
  }
  return map;
}

function analyticsTable(supabase: Supabase, options: AnalyticsDashboardServerOptions) {
  const tableName = options.tableName ?? "analytics_logs";
  const schema = analyticsSchema(options);
  return analyticsTableByName(supabase, schema, tableName);
}

function analyticsTableByName(supabase: Supabase, schema: string | undefined, tableName: string): any {
  const client = supabase as unknown as LooseSupabase;
  return schema ? client.schema(schema).from(tableName) : client.from(tableName);
}

function analyticsSchema(options: AnalyticsDashboardServerOptions): string | undefined {
  return options.schema ?? (options.business ? analyticsSchemaForBusiness(options.business) : undefined);
}

function parseDashboardQuery(request: Request): QueryParams {
  const searchParams = new URL(request.url).searchParams;
  const range = parseRange(searchParams.get("range"));
  const visitorLimit = Math.min(
    Number.parseInt(searchParams.get("visitor_limit") ?? searchParams.get("limit") ?? "1000", 10) ||
      1000,
    5000
  );
  return {
    range,
    excludeAdmin: searchParams.get("exclude_admin") !== "false",
    excludeBots:
      (searchParams.get("exclude_bots") ?? searchParams.get("excludeBots")) !== "false",
    visitorLimit,
    tz: normalizeTimeZone(searchParams.get("tz")),
  };
}

function withDefaultParams(params: Partial<QueryParams>): QueryParams {
  return {
    range: params.range ?? "7d",
    excludeAdmin: params.excludeAdmin ?? true,
    excludeBots: params.excludeBots ?? true,
    visitorLimit: params.visitorLimit ?? 1000,
    tz: normalizeTimeZone(params.tz),
  };
}

function normalizeTimeZone(input: string | null | undefined): string | undefined {
  if (!input) return undefined;
  try {
    // Throws RangeError if the IANA name is unknown; rejects garbage from clients.
    new Intl.DateTimeFormat([], { timeZone: input });
    return input;
  } catch {
    return undefined;
  }
}

function parseRange(value: string | null): AnalyticsDashboardRange {
  if (value === "24h" || value === "7d" || value === "30d" || value === "all") return value;
  return "7d";
}

function rangeStart(range: AnalyticsDashboardRange): Date | null {
  const now = new Date();
  if (range === "24h") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (range === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

function filterLogs(
  logs: AnalyticsEventRow[],
  options: AnalyticsDashboardServerOptions,
  excludeAdmin: boolean,
  excludeBots: boolean
): AnalyticsEventRow[] {
  return logs.filter((log) => {
    if (excludeAdmin && isAdminIp(log.ip_address, options.adminIps ?? [])) return false;
    if (excludeBots) {
      const result = classifyLogs([log]);
      if (result.botLikely || result.classification === "bot_likely") return false;
    }
    return true;
  });
}

function isAdminIp(ip: string | null | undefined, adminIps: string[]): boolean {
  if (!ip) return false;
  const stripped = ip.replace(/^::ffff:/i, "");
  return adminIps.includes(ip) || adminIps.includes(stripped);
}

function classifyLogs(logs: AnalyticsEventRow[]) {
  return classifyVisit(
    logs.map((log) => ({
      event_name: log.event_name,
      path: log.path,
      created_at: log.created_at,
      session_id: log.session_id,
      anonymous_id: log.anonymous_id,
      user_agent: log.user_agent,
      metadata: log.metadata ?? {},
    }))
  );
}

function visitorKeyForLog(log: AnalyticsEventRow): string {
  const email = asString(log.metadata?.email);
  const sid = asString(log.metadata?.sid);
  const identity = email ?? sid ?? log.session_id ?? log.anonymous_id ?? "";
  return `${log.ip_address ?? "unknown"}::${identity}`;
}

function uniqueVisitorIds(logs: AnalyticsEventRow[]): Set<string> {
  return new Set(logs.map(visitorKeyForLog));
}

function countLiveUsers(logs: AnalyticsEventRow[]): number {
  const threshold = Date.now() - 5 * 60 * 1000;
  return uniqueVisitorIds(logs.filter((log) => new Date(log.created_at).getTime() >= threshold)).size;
}

function buildChartData(
  logs: AnalyticsEventRow[],
  range: AnalyticsDashboardRange,
  tz?: string
): AnalyticsChartPoint[] {
  const buckets = new Map<string, AnalyticsEventRow[]>();
  const ordered = [...logs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  for (const log of ordered) {
    const name = bucketName(log.created_at, range, tz);
    const bucket = buckets.get(name) ?? [];
    bucket.push(log);
    buckets.set(name, bucket);
  }
  return Array.from(buckets.entries()).map(([name, bucketLogs]) => {
    const pageviews = bucketLogs.filter((log) => log.event_name === "pageview");
    const visitors = uniqueVisitorIds(bucketLogs).size;
    return {
      name,
      visitors,
      pageviews: pageviews.length,
      unique_pages: new Set(pageviews.map((log) => log.path)).size,
      avg_per_user: visitors > 0 ? Number((pageviews.length / visitors).toFixed(1)) : 0,
    };
  });
}

function bucketName(value: string, range: AnalyticsDashboardRange, tz?: string): string {
  const date = new Date(value);
  if (range === "24h") {
    return date.toLocaleTimeString([], { hour: "numeric", timeZone: tz });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric", timeZone: tz });
}

function buildAbResults(logs: AnalyticsEventRow[]) {
  const variants = new Map<string, { visitors: Set<string>; conversions: number }>();
  for (const log of logs) {
    const variant = asString(log.metadata?.checkout_ab) ?? asString(log.metadata?.checkout_source);
    if (!variant) continue;
    const entry = variants.get(variant) ?? { visitors: new Set<string>(), conversions: 0 };
    entry.visitors.add(visitorKeyForLog(log));
    if (log.event_name === "purchase") entry.conversions += 1;
    variants.set(variant, entry);
  }
  return Array.from(variants.entries()).map(([variant, entry]) => ({
    variant,
    visitors: entry.visitors.size,
    conversions: entry.conversions,
    conversion_rate:
      entry.visitors.size > 0 ? Number(((entry.conversions / entry.visitors.size) * 100).toFixed(2)) : 0,
  }));
}

function firstMetadataString(logs: AnalyticsEventRow[], key: string): string | undefined {
  for (const log of logs) {
    const value = asString(log.metadata?.[key]);
    if (value) return value;
  }
  return undefined;
}

function sourceForLog(log: AnalyticsEventRow | undefined): string | undefined {
  if (!log?.metadata) return undefined;
  const utmSource = asString(log.metadata.utm_source);
  if (utmSource) {
    const parts = [`utm_source=${utmSource}`];
    const medium = asString(log.metadata.utm_medium);
    const campaign = asString(log.metadata.utm_campaign);
    if (medium) parts.push(`utm_medium=${medium}`);
    if (campaign) parts.push(`utm_campaign=${campaign}`);
    return parts.join("&");
  }
  const referrer = asString(log.metadata.referrer);
  if (!referrer) return undefined;
  try {
    const url = new URL(referrer);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

function sourceUrlForLog(log: AnalyticsEventRow | undefined): string | undefined {
  return asString(log?.metadata?.referrer);
}

function totalDurationSeconds(logs: AnalyticsEventRow[]): number {
  return logs.reduce((total, log) => {
    const duration = numberFromMetadata(log.metadata, "duration_seconds");
    if (log.event_name !== "page_leave" || duration === null || duration <= 0 || duration >= 3600) {
      return total;
    }
    return total + duration;
  }, 0);
}

function numberFromMetadata(metadata: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = metadata?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function deviceFromUserAgent(userAgent: string | null | undefined): AnalyticsVisitorSummary["device"] {
  const ua = userAgent ?? "";
  if (!ua) return "Unknown";
  if (/bot|crawl|spider|slurp|facebookexternalhit|Twitterbot|LinkedInBot/i.test(ua)) return "Bot";
  if (/iPad|tablet|Kindle|Silk|PlayBook/i.test(ua)) return "Tablet";
  if (/Mobile|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)) {
    return "Mobile";
  }
  return "Desktop";
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: NO_CACHE_HEADERS,
  });
}

function createDashboardSchemaExposureChecker(options: AnalyticsDashboardServerOptions) {
  const schema = analyticsSchema(options);
  if (!schema) return undefined;
  return createAnalyticsSchemaExposureChecker({
    schema,
    tableName: options.tableName,
    supabaseUrl: options.supabaseUrl,
  });
}

async function ensureDashboardSchemaExposed(
  ensureSchemaExposed:
    | ReturnType<typeof createAnalyticsSchemaExposureChecker>
    | undefined,
  options: AnalyticsDashboardServerOptions
): Promise<void> {
  if (!ensureSchemaExposed) return;
  const supabase = createDashboardSupabaseClient(options);
  await ensureSchemaExposed(supabase as unknown as SchemaExposureCheckClient);
}

function dashboardErrorResponse(
  label: string,
  fallbackMessage: string,
  error: unknown
): Response {
  if (isAnalyticsSchemaNotExposedError(error)) {
    console.error(error.message);
    return json({ error: "analytics schema not exposed", fix: error.fix }, 503);
  }

  console.error(`[Analytics Dashboard] ${label} error:`, error);
  return json({ error: fallbackMessage }, 500);
}
