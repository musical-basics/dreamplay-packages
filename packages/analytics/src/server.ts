import {
  ANALYTICS_SCHEMA_BY_BUSINESS,
  analyticsSchemaForBusiness,
  parseBusinessAnalyticsEvent,
  type BusinessAnalyticsEvent,
  type ParseAnalyticsEventResult,
} from "./schema.js";
export {
  VISIT_CLASSIFICATION_REASON_LABELS,
  classifyVisit,
  describeVisitClassificationReason,
  normalizeVisitEvents,
  type NormalizedVisitEvent,
  type VisitClassification,
  type VisitClassificationEvent,
  type VisitClassificationOptions,
  type VisitClassificationReason,
  type VisitClassificationResult,
  type VisitClassificationStats,
} from "./classification.js";
export {
  createBusinessAnalyticsTrackHandler,
  createBusinessAnalyticsTrackOptionsHandler,
  type BusinessAnalyticsTrackHandlerOptions,
} from "./track-server.js";
export {
  createAnalyticsDashboardEmailVisitorsHandler,
  createAnalyticsDashboardStatsHandler,
  createAnalyticsDashboardVisitorHistoryHandler,
  createDashboardSupabaseClient,
  getAnalyticsDashboardData,
  getAnalyticsEmailVisitors,
  getAnalyticsVisitorHistory,
  type AnalyticsDashboardServerOptions,
} from "./dashboard-server.js";
export type {
  AnalyticsAbResult,
  AnalyticsChartPoint,
  AnalyticsDashboardData,
  AnalyticsDashboardRange,
  AnalyticsDashboardTab,
  AnalyticsEmailVisitorData,
  AnalyticsEventRow,
  AnalyticsVisitorHistory,
  AnalyticsVisitorHistoryVisit,
  AnalyticsVisitorSummary,
} from "./dashboard-types.js";

export type HeaderReader = {
  get(name: string): string | null;
};

export type CorsOptions = {
  allowedOrigins: string[];
  allowVercelPreviews?: boolean;
  allowLocalhost?: boolean;
  methods?: string;
  headers?: string;
};

export function parseTrackBody(input: unknown): ParseAnalyticsEventResult {
  return parseBusinessAnalyticsEvent(input);
}

export { parseBusinessAnalyticsEvent };
export { ANALYTICS_SCHEMA_BY_BUSINESS, analyticsSchemaForBusiness };
export type { BusinessAnalyticsEvent, ParseAnalyticsEventResult };

export function resolveClientIp(headers: HeaderReader): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") || "unknown";
}

export function isLikelyBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return /bot|spider|crawl|headless|lighthouse|pingdom/i.test(userAgent);
}

export function isAllowedOrigin(origin: string | null, options: CorsOptions): boolean {
  if (!origin) return false;
  if (options.allowedOrigins.includes(origin)) return true;
  if (options.allowVercelPreviews && origin.endsWith(".vercel.app")) return true;
  if (options.allowLocalhost && origin.includes("localhost")) return true;
  return false;
}

export function corsHeaders(origin: string | null, options: CorsOptions): Record<string, string> {
  if (!isAllowedOrigin(origin, options)) return {};
  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Methods": options.methods ?? "POST, OPTIONS",
    "Access-Control-Allow-Headers": options.headers ?? "Content-Type, Authorization",
  };
}
