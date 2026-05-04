import { createEmailSupabaseClient, emailError, emailJson } from "./database.js";
export const DEFAULT_FROM_DOMAIN_TRACKING_BASE_URLS = {
    "musicalbasics.com": "https://link.musicalbasics.com",
    "ultimatepianist.com": "https://link.ultimatepianist.com",
    "dreamplaypianos.com": "https://email.dreamplaypianos.com",
    "email.dreamplaypianos.com": "https://email.dreamplaypianos.com",
};
export function pickTrackingBaseUrl(fromEmail, options = {}) {
    if (fromEmail) {
        const domain = fromEmail.split("@").pop()?.toLowerCase().trim();
        const mappings = {
            ...DEFAULT_FROM_DOMAIN_TRACKING_BASE_URLS,
            ...(options.fromDomainTrackingBaseUrls ?? {}),
        };
        if (domain && mappings[domain])
            return mappings[domain];
    }
    return options.trackingBaseUrl ?? process.env.TRACKING_BASE_URL ?? "https://email.dreamplaypianos.com";
}
export function appendEmailAttributionToLinks(html, input) {
    return html.replace(/href=(["'])(https?:\/\/[^"']+)\1/g, (match, quote, url) => {
        if (url.includes("/unsubscribe"))
            return match;
        const withParams = appendSidCid(url, input.subscriberId, input.campaignId);
        if (input.clickTrackingMode === "redirect") {
            const redirectUrl = `${input.trackingBaseUrl ?? ""}/api/track/click?c=${encodeURIComponent(input.campaignId)}` +
                `&s=${encodeURIComponent(input.subscriberId)}&u=${encodeURIComponent(withParams)}`;
            return `href=${quote}${redirectUrl}${quote}`;
        }
        return `href=${quote}${withParams}${quote}`;
    });
}
export function injectOpenPixel(html, input) {
    const openPixel = `<img src="${input.trackingBaseUrl}/api/track/open?c=${input.campaignId}&s=${input.subscriberId}" width="1" height="1" alt="" style="display:none !important;width:1px;height:1px;opacity:0;" />`;
    const withBody = html.replace(/<\/body>/i, `${openPixel}</body>`);
    return withBody === html ? html + openPixel : withBody;
}
export function createEmailOpenTrackingHandler(options = {}) {
    return async function GET(request) {
        const url = new URL(request.url);
        const campaignId = url.searchParams.get("c");
        const subscriberId = url.searchParams.get("s");
        if (!campaignId || !subscriberId)
            return transparentPixel();
        const supabase = createEmailSupabaseClient(options);
        await supabase.from("subscriber_events").insert({
            campaign_id: campaignId,
            subscriber_id: subscriberId,
            type: "open",
            ip_address: resolveClientIp(request.headers),
            user_agent: request.headers.get("user-agent"),
        });
        await supabase.rpc("increment_campaign_opens", { campaign_uuid: campaignId }).then(undefined, () => { });
        return transparentPixel();
    };
}
export function createEmailClickTrackingHandler(options = {}) {
    return async function GET(request) {
        const url = new URL(request.url);
        const campaignId = url.searchParams.get("c");
        const subscriberId = url.searchParams.get("s");
        const destination = url.searchParams.get("u");
        if (!campaignId || !subscriberId || !destination) {
            return emailError("Missing click tracking params", 400);
        }
        const supabase = createEmailSupabaseClient(options);
        await supabase.from("subscriber_events").insert({
            campaign_id: campaignId,
            subscriber_id: subscriberId,
            type: "click",
            url: destination,
            ip_address: resolveClientIp(request.headers),
            user_agent: request.headers.get("user-agent"),
        });
        return Response.redirect(destination, 302);
    };
}
export function createEmailTrackingHealthHandler(options = {}) {
    return function GET() {
        const hasSupabase = Boolean(options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL) &&
            Boolean(options.supabaseServiceRoleKey ?? process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);
        return emailJson({
            ok: hasSupabase,
            service: "@dreamplay/emailer",
            tracking: {
                open: "/api/track/open",
                click: "/api/track/click",
                attribution: "sid/cid appended to destination URLs for @dreamplay/analytics",
            },
        }, hasSupabase ? 200 : 503);
    };
}
function appendSidCid(url, subscriberId, campaignId) {
    try {
        const parsed = new URL(url);
        parsed.searchParams.set("sid", subscriberId);
        parsed.searchParams.set("cid", campaignId);
        return parsed.toString();
    }
    catch {
        const sep = url.includes("?") ? "&" : "?";
        return `${url}${sep}sid=${encodeURIComponent(subscriberId)}&cid=${encodeURIComponent(campaignId)}`;
    }
}
function resolveClientIp(headers) {
    const forwardedFor = headers.get("x-forwarded-for");
    if (forwardedFor)
        return forwardedFor.split(",")[0]?.trim() || "unknown";
    return headers.get("x-real-ip") || "unknown";
}
function transparentPixel() {
    const bytes = Uint8Array.from([
        71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 255, 255, 255,
        33, 249, 4, 1, 0, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68,
        1, 0, 59,
    ]);
    return new Response(bytes, {
        headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "no-store, no-cache, max-age=0",
        },
    });
}
//# sourceMappingURL=tracking-server.js.map