import { ANALYTICS_SCHEMA_BY_BUSINESS, analyticsSchemaForBusiness, parseBusinessAnalyticsEvent, } from "./schema.js";
export function parseTrackBody(input) {
    return parseBusinessAnalyticsEvent(input);
}
export { parseBusinessAnalyticsEvent };
export { ANALYTICS_SCHEMA_BY_BUSINESS, analyticsSchemaForBusiness };
export function resolveClientIp(headers) {
    const forwardedFor = headers.get("x-forwarded-for");
    if (forwardedFor)
        return forwardedFor.split(",")[0]?.trim() || "unknown";
    return headers.get("x-real-ip") || "unknown";
}
export function isLikelyBotUserAgent(userAgent) {
    if (!userAgent)
        return false;
    return /bot|spider|crawl|headless|lighthouse|pingdom/i.test(userAgent);
}
export function isAllowedOrigin(origin, options) {
    if (!origin)
        return false;
    if (options.allowedOrigins.includes(origin))
        return true;
    if (options.allowVercelPreviews && origin.endsWith(".vercel.app"))
        return true;
    if (options.allowLocalhost && origin.includes("localhost"))
        return true;
    return false;
}
export function corsHeaders(origin, options) {
    if (!isAllowedOrigin(origin, options))
        return {};
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": options.methods ?? "POST, OPTIONS",
        "Access-Control-Allow-Headers": options.headers ?? "Content-Type, Authorization",
    };
}
//# sourceMappingURL=server.js.map