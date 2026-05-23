import type { VisitClassificationResult } from "./classification.js";
export type AnalyticsDashboardRange = "24h" | "7d" | "30d" | "all";
export type AnalyticsDashboardTab = "overview" | "visitors" | "emailVisitors" | "insights" | "ab" | "logs" | "chats" | "exports";
export type AnalyticsEventRow = {
    id?: string;
    created_at: string;
    event_name: string;
    path: string;
    ip_address?: string | null;
    country?: string | null;
    city?: string | null;
    region?: string | null;
    session_id?: string | null;
    anonymous_id?: string | null;
    tracker_version?: string | null;
    user_agent?: string | null;
    metadata?: Record<string, unknown> | null;
};
export type AnalyticsChartPoint = {
    name: string;
    visitors: number;
    pageviews: number;
    unique_pages: number;
    avg_per_user: number;
};
export type AnalyticsVisitorSummary = {
    visitorKey: string;
    ip: string;
    count: number;
    lastPath: string;
    lastSeen: string;
    country: string;
    city?: string | null;
    region?: string | null;
    device: "Desktop" | "Mobile" | "Tablet" | "Bot" | "Unknown";
    email?: string;
    sid?: string;
    cid?: string;
    source?: string;
    sourceUrl?: string;
    variant?: string;
    totalTimeSeconds: number;
    journey_id?: string;
    classification?: VisitClassificationResult;
};
export type AnalyticsVisitorHistoryVisit = {
    path: string;
    visited_at: string;
    duration_seconds: number | null;
    metadata?: Record<string, unknown> | null;
};
export type AnalyticsVisitorHistory = {
    visits: AnalyticsVisitorHistoryVisit[];
    total_pageviews: number;
    first_seen: string | null;
    last_seen: string | null;
    geo?: {
        country: string | null;
        city: string | null;
        region: string | null;
    };
    classification?: VisitClassificationResult;
};
export type AnalyticsAbResult = {
    variant: string;
    label?: string;
    visitors: number;
    conversions: number;
    conversion_rate: number | string;
};
export type AnalyticsDashboardData = {
    liveUsers: number;
    totalPageviews: number;
    uniqueVisitors: number;
    uniquePages: number;
    chartData: AnalyticsChartPoint[];
    recentEvents: AnalyticsEventRow[];
    abResults: AnalyticsAbResult[];
    visitorStats: AnalyticsVisitorSummary[];
};
export type AnalyticsEmailVisitorData = {
    emailVisitorStats: AnalyticsVisitorSummary[];
};
//# sourceMappingURL=dashboard-types.d.ts.map