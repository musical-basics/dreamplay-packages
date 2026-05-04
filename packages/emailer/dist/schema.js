export const DEFAULT_SUBSCRIBE_ENDPOINT = "https://email.dreamplaypianos.com/api/webhooks/subscribe";
export const EMAIL_WORKSPACES = [
    "dreamplay_marketing",
    "dreamplay_support",
    "musicalbasics",
    "crossover",
    "concert_marketing",
];
export function normalizeEmail(value) {
    return value.trim().toLowerCase();
}
export function normalizeTags(tags) {
    return Array.from(new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean)));
}
export function assertValidSubscribePayload(payload) {
    const email = normalizeEmail(payload.email ?? "");
    if (!email)
        throw new Error("email is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error("email is invalid");
    if (payload.tags && !Array.isArray(payload.tags)) {
        throw new Error("tags must be an array");
    }
}
export function metadataFromHeaders(headers) {
    const forwardedFor = headers.get("x-forwarded-for");
    const metadata = {};
    const city = decodeHeaderValue(headers.get("x-vercel-ip-city"));
    const country = headers.get("x-vercel-ip-country");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || headers.get("x-real-ip");
    if (city)
        metadata.city = city;
    if (country)
        metadata.country = country;
    if (ipAddress)
        metadata.ip_address = ipAddress;
    return metadata;
}
function decodeHeaderValue(value) {
    if (!value)
        return null;
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
}
//# sourceMappingURL=schema.js.map