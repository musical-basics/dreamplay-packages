export const ANALYTICS_SCHEMA_BY_BUSINESS = {
    dreamplay: "dreamplay_analytics",
    musicalbasics: "musicalbasics_analytics",
    concert: "concert_analytics",
};
export const ATTRIBUTION_KEYS = [
    "sid",
    "cid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
];
export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isKnownBusiness(value) {
    return Object.hasOwn(ANALYTICS_SCHEMA_BY_BUSINESS, value);
}
export function analyticsSchemaForBusiness(business) {
    return isKnownBusiness(business) ? ANALYTICS_SCHEMA_BY_BUSINESS[business] : undefined;
}
export function asString(value) {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
export function asFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
export function pickAttribution(value) {
    const out = {};
    for (const key of ATTRIBUTION_KEYS) {
        const str = asString(value[key]);
        if (str)
            out[key] = str;
    }
    return out;
}
export function parseBusinessAnalyticsEvent(input) {
    const errors = [];
    if (!isRecord(input))
        return { ok: false, errors: ["Body must be an object"] };
    const eventName = asString(input.event_name) ?? asString(input.eventName);
    const path = asString(input.path);
    const sessionId = asString(input.session_id) ?? asString(input.sessionId);
    const anonymousId = asString(input.anonymous_id);
    const trackerVersion = asString(input.tracker_version);
    const metadataInput = input.metadata;
    if (!eventName)
        errors.push("event_name is required");
    if (!path)
        errors.push("path is required");
    if (!sessionId)
        errors.push("session_id is required");
    if (!anonymousId)
        errors.push("anonymous_id is required");
    if (!trackerVersion)
        errors.push("tracker_version is required");
    if (!isRecord(metadataInput))
        errors.push("metadata must be an object");
    if (errors.length > 0 || !eventName || !path || !sessionId || !anonymousId || !trackerVersion || !isRecord(metadataInput)) {
        return { ok: false, errors };
    }
    const business = asString(metadataInput.business);
    const host = asString(metadataInput.host);
    if (!business)
        errors.push("metadata.business is required");
    if (!host)
        errors.push("metadata.host is required");
    if (errors.length > 0 || !business || !host)
        return { ok: false, errors };
    const metadata = {
        ...metadataInput,
        business,
        host,
    };
    const referrer = metadataInput.referrer;
    if (typeof referrer === "string" || referrer === null)
        metadata.referrer = referrer;
    const durationSeconds = asFiniteNumber(metadataInput.duration_seconds);
    if (durationSeconds !== undefined)
        metadata.duration_seconds = durationSeconds;
    const revenue = asFiniteNumber(metadataInput.revenue);
    if (revenue !== undefined)
        metadata.revenue = revenue;
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
//# sourceMappingURL=schema.js.map