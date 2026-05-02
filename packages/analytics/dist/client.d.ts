import { type AnalyticsEventName, type AttributionMetadata, type Business, type BusinessAnalyticsEvent, type JsonObject } from "./schema.js";
export type BusinessAnalyticsConfig = {
    business: Business;
    endpoint: string;
    brand?: string;
    offer?: string;
    sourceRepo?: string;
    trackerVersion?: string;
    storagePrefix?: string;
    defaultMetadata?: JsonObject;
    includeHostInPath?: boolean;
};
export type TrackOptions = {
    path?: string;
    useBeacon?: boolean;
};
export type PageLeaveOptions = TrackOptions & {
    startedAt?: number;
    durationSeconds?: number;
    metadata?: JsonObject;
};
export type LifecycleOptions = {
    trackPageview?: boolean;
    minDurationSeconds?: number;
    pageviewMetadata?: JsonObject;
    pageLeaveMetadata?: JsonObject;
};
export type TrackResult = {
    ok: boolean;
    status?: number;
    error?: unknown;
    usedBeacon?: boolean;
};
export type BusinessAnalyticsClient = {
    captureAttribution: () => AttributionMetadata;
    getAttribution: () => AttributionMetadata;
    getSessionId: () => string;
    getAnonymousId: () => string;
    buildEvent: (eventName: AnalyticsEventName, metadata?: JsonObject, options?: TrackOptions) => BusinessAnalyticsEvent;
    track: (eventName: AnalyticsEventName, metadata?: JsonObject, options?: TrackOptions) => Promise<TrackResult>;
    trackPageview: (metadata?: JsonObject, options?: TrackOptions) => Promise<TrackResult>;
    trackPageLeave: (options?: PageLeaveOptions) => Promise<TrackResult>;
    installPageLifecycleTracking: (options?: LifecycleOptions) => () => void;
};
export declare function createBusinessAnalytics(config: BusinessAnalyticsConfig): BusinessAnalyticsClient;
//# sourceMappingURL=client.d.ts.map