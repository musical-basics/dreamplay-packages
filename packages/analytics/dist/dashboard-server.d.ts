import { createClient } from "@supabase/supabase-js";
import { type Business } from "./schema.js";
import type { AnalyticsDashboardData, AnalyticsDashboardRange, AnalyticsEmailVisitorData, AnalyticsVisitorHistory } from "./dashboard-types.js";
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
type QueryParams = {
    range: AnalyticsDashboardRange;
    excludeAdmin: boolean;
    excludeBots: boolean;
    visitorLimit: number;
};
export declare function createAnalyticsDashboardStatsHandler(options: AnalyticsDashboardServerOptions): (request: Request) => Promise<Response>;
export declare function createAnalyticsDashboardVisitorHistoryHandler(options: AnalyticsDashboardServerOptions): (request: Request) => Promise<Response>;
export declare function createAnalyticsDashboardEmailVisitorsHandler(options: AnalyticsDashboardServerOptions): (request: Request) => Promise<Response>;
export declare function getAnalyticsDashboardData(options: AnalyticsDashboardServerOptions, params?: Partial<QueryParams>): Promise<AnalyticsDashboardData>;
export declare function getAnalyticsEmailVisitors(options: AnalyticsDashboardServerOptions, params?: Partial<QueryParams>): Promise<AnalyticsEmailVisitorData>;
export declare function getAnalyticsVisitorHistory(options: AnalyticsDashboardServerOptions, params: {
    range?: AnalyticsDashboardRange;
    excludeAdmin?: boolean;
    excludeBots?: boolean;
    ip?: string;
    visitorKey?: string;
}): Promise<AnalyticsVisitorHistory>;
export declare function createDashboardSupabaseClient(options: AnalyticsDashboardServerOptions): Supabase;
export {};
//# sourceMappingURL=dashboard-server.d.ts.map