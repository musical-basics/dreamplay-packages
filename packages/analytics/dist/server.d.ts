import { ANALYTICS_SCHEMA_BY_BUSINESS, analyticsSchemaForBusiness, parseBusinessAnalyticsEvent, type BusinessAnalyticsEvent, type ParseAnalyticsEventResult } from "./schema.js";
export { VISIT_CLASSIFICATION_REASON_LABELS, classifyVisit, describeVisitClassificationReason, normalizeVisitEvents, type NormalizedVisitEvent, type VisitClassification, type VisitClassificationEvent, type VisitClassificationOptions, type VisitClassificationReason, type VisitClassificationResult, type VisitClassificationStats, } from "./classification.js";
export { createBusinessAnalyticsTrackHandler, createBusinessAnalyticsTrackOptionsHandler, type BusinessAnalyticsTrackHandlerOptions, } from "./track-server.js";
export { createAnalyticsDashboardEmailVisitorsHandler, createAnalyticsDashboardStatsHandler, createAnalyticsDashboardVisitorHistoryHandler, createDashboardSupabaseClient, getAnalyticsDashboardData, getAnalyticsEmailVisitors, getAnalyticsVisitorHistory, type AnalyticsDashboardServerOptions, } from "./dashboard-server.js";
export type { AnalyticsAbResult, AnalyticsChartPoint, AnalyticsDashboardData, AnalyticsDashboardRange, AnalyticsDashboardTab, AnalyticsEmailVisitorData, AnalyticsEventRow, AnalyticsVisitorHistory, AnalyticsVisitorHistoryVisit, AnalyticsVisitorSummary, } from "./dashboard-types.js";
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
export declare function parseTrackBody(input: unknown): ParseAnalyticsEventResult;
export { parseBusinessAnalyticsEvent };
export { ANALYTICS_SCHEMA_BY_BUSINESS, analyticsSchemaForBusiness };
export type { BusinessAnalyticsEvent, ParseAnalyticsEventResult };
export declare function resolveClientIp(headers: HeaderReader): string;
export declare function isLikelyBotUserAgent(userAgent: string | null): boolean;
export declare function isAllowedOrigin(origin: string | null, options: CorsOptions): boolean;
export declare function corsHeaders(origin: string | null, options: CorsOptions): Record<string, string>;
//# sourceMappingURL=server.d.ts.map