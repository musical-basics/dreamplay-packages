export type KnownBusiness = "dreamplay" | "musicalbasics" | "concert";
export type Business = KnownBusiness | (string & {});

export const ANALYTICS_SCHEMA_BY_BUSINESS = {
  dreamplay: "dreamplay_analytics",
  musicalbasics: "musicalbasics_analytics",
  concert: "concert_analytics",
} as const satisfies Record<KnownBusiness, string>;

export type AnalyticsSchemaName =
  (typeof ANALYTICS_SCHEMA_BY_BUSINESS)[keyof typeof ANALYTICS_SCHEMA_BY_BUSINESS];

export type KnownAnalyticsEventName =
  | "pageview"
  | "page_leave"
  | "checkout_start"
  | "lead"
  | "purchase"
  | "video_play"
  | "scroll_depth";

export type AnalyticsEventName = KnownAnalyticsEventName | (string & {});

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

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

export type ParseAnalyticsEventResult =
  | { ok: true; event: BusinessAnalyticsEvent }
  | { ok: false; errors: string[] };

export const ATTRIBUTION_KEYS = [
  "sid",
  "cid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];

export type AttributionMetadata = Partial<Record<AttributionKey, string>>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isKnownBusiness(value: string): value is KnownBusiness {
  return Object.hasOwn(ANALYTICS_SCHEMA_BY_BUSINESS, value);
}

export function analyticsSchemaForBusiness(business: Business): AnalyticsSchemaName | undefined {
  return isKnownBusiness(business) ? ANALYTICS_SCHEMA_BY_BUSINESS[business] : undefined;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function pickAttribution(value: Record<string, unknown>): AttributionMetadata {
  const out: AttributionMetadata = {};
  for (const key of ATTRIBUTION_KEYS) {
    const str = asString(value[key]);
    if (str) out[key] = str;
  }
  return out;
}

export function parseBusinessAnalyticsEvent(input: unknown): ParseAnalyticsEventResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["Body must be an object"] };

  const eventName = asString(input.event_name) ?? asString(input.eventName);
  const path = asString(input.path);
  const sessionId = asString(input.session_id) ?? asString(input.sessionId);
  const anonymousId = asString(input.anonymous_id);
  const trackerVersion = asString(input.tracker_version);
  const metadataInput = input.metadata;

  if (!eventName) errors.push("event_name is required");
  if (!path) errors.push("path is required");
  if (!sessionId) errors.push("session_id is required");
  if (!anonymousId) errors.push("anonymous_id is required");
  if (!trackerVersion) errors.push("tracker_version is required");
  if (!isRecord(metadataInput)) errors.push("metadata must be an object");

  if (errors.length > 0 || !eventName || !path || !sessionId || !anonymousId || !trackerVersion || !isRecord(metadataInput)) {
    return { ok: false, errors };
  }

  const business = asString(metadataInput.business);
  const host = asString(metadataInput.host);
  if (!business) errors.push("metadata.business is required");
  if (!host) errors.push("metadata.host is required");
  if (errors.length > 0 || !business || !host) return { ok: false, errors };

  const metadata: BusinessAnalyticsMetadata = {
    ...(metadataInput as JsonObject),
    business,
    host,
  };

  const referrer = metadataInput.referrer;
  if (typeof referrer === "string" || referrer === null) metadata.referrer = referrer;

  const durationSeconds = asFiniteNumber(metadataInput.duration_seconds);
  if (durationSeconds !== undefined) metadata.duration_seconds = durationSeconds;

  const revenue = asFiniteNumber(metadataInput.revenue);
  if (revenue !== undefined) metadata.revenue = revenue;

  return {
    ok: true,
    event: {
      event_name: eventName,
      eventName,
      path,
      session_id: sessionId,
      sessionId,
      anonymous_id: anonymousId,
      tracker_version: trackerVersion,
      metadata,
    },
  };
}
