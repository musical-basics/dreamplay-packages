export type KnownBusiness = "dreamplay" | "musicalbasics" | "concert";
export type Business = KnownBusiness | (string & {});
export declare const ANALYTICS_SCHEMA_BY_BUSINESS: {
    readonly dreamplay: "dreamplay_analytics";
    readonly musicalbasics: "musicalbasics_analytics";
    readonly concert: "concert_analytics";
};
export type AnalyticsSchemaName = (typeof ANALYTICS_SCHEMA_BY_BUSINESS)[keyof typeof ANALYTICS_SCHEMA_BY_BUSINESS];
export type KnownAnalyticsEventName = "pageview" | "page_leave" | "checkout_start" | "lead" | "purchase" | "video_play" | "scroll_depth";
export type AnalyticsEventName = KnownAnalyticsEventName | (string & {});
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = {
    [key: string]: JsonValue;
};
export type BusinessAnalyticsMetadata = JsonObject & {
    business: Business;
    brand?: string;
    offer?: string;
    host: string;
    referrer?: string | null;
    sid?: string;
    cid?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
    duration_seconds?: number;
    checkout_id?: string;
    order_id?: string;
    revenue?: number;
    currency?: string;
    source_repo?: string;
};
export type BusinessAnalyticsEvent = {
    event_name: AnalyticsEventName;
    /**
     * Backward-compatible alias for older ingestion routes that expect eventName.
     */
    eventName?: AnalyticsEventName;
    path: string;
    session_id: string;
    /**
     * Backward-compatible alias for older ingestion routes that expect sessionId.
     */
    sessionId?: string;
    anonymous_id: string;
    tracker_version: string;
    metadata: BusinessAnalyticsMetadata;
};
export type ParseAnalyticsEventResult = {
    ok: true;
    event: BusinessAnalyticsEvent;
} | {
    ok: false;
    errors: string[];
};
export declare const ATTRIBUTION_KEYS: readonly ["sid", "cid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
export type AttributionMetadata = Partial<Record<AttributionKey, string>>;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function isKnownBusiness(value: string): value is KnownBusiness;
export declare function analyticsSchemaForBusiness(business: Business): AnalyticsSchemaName | undefined;
export declare function asString(value: unknown): string | undefined;
export declare function asFiniteNumber(value: unknown): number | undefined;
export declare function pickAttribution(value: Record<string, unknown>): AttributionMetadata;
export declare function parseBusinessAnalyticsEvent(input: unknown): ParseAnalyticsEventResult;
//# sourceMappingURL=schema.d.ts.map