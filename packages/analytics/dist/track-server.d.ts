import { type Business } from "./schema.js";
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
export declare function createBusinessAnalyticsTrackHandler(options: BusinessAnalyticsTrackHandlerOptions): (request: Request) => Promise<Response>;
export declare function createBusinessAnalyticsTrackOptionsHandler(options: BusinessAnalyticsTrackHandlerOptions): (request: Request) => Promise<Response>;
//# sourceMappingURL=track-server.d.ts.map