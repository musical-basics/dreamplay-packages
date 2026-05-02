import { createClient } from "@supabase/supabase-js";
import { classifyVisit } from "./classification.js";
import { analyticsSchemaForBusiness, asString } from "./schema.js";
const NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    Pragma: "no-cache",
    Expires: "0",
};
export function createAnalyticsDashboardStatsHandler(options) {
    return async function GET(request) {
        try {
            const params = parseDashboardQuery(request);
            const data = await getAnalyticsDashboardData(options, params);
            return json(data);
        }
        catch (error) {
            console.error("[Analytics Dashboard] stats error:", error);
            return json({ error: "Failed to fetch analytics stats" }, 500);
        }
    };
}
export function createAnalyticsDashboardVisitorHistoryHandler(options) {
    return async function GET(request) {
        try {
            const url = new URL(request.url);
            const ip = url.searchParams.get("ip");
            const visitorKey = url.searchParams.get("visitor_key");
            if (!ip && !visitorKey)
                return json({ error: "Missing ip or visitor_key" }, 400);
            const params = parseDashboardQuery(request);
            const history = await getAnalyticsVisitorHistory(options, {
                range: params.range,
                excludeAdmin: params.excludeAdmin,
                excludeBots: params.excludeBots,
                ip: ip ?? undefined,
                visitorKey: visitorKey ?? undefined,
            });
            return json(history);
        }
        catch (error) {
            console.error("[Analytics Dashboard] visitor history error:", error);
            return json({ error: "Failed to fetch visitor history" }, 500);
        }
    };
}
export function createAnalyticsDashboardEmailVisitorsHandler(options) {
    return async function GET(request) {
        try {
            const params = parseDashboardQuery(request);
            const data = await getAnalyticsEmailVisitors(options, params);
            return json(data);
        }
        catch (error) {
            console.error("[Analytics Dashboard] email visitors error:", error);
            return json({ error: "Failed to fetch email visitors" }, 500);
        }
    };
}
export async function getAnalyticsDashboardData(options, params = {}) {
    const merged = withDefaultParams(params);
    const supabase = createDashboardSupabaseClient(options);
    const logs = await fetchAnalyticsLogs(supabase, options, merged.range, merged.visitorLimit);
    const filteredLogs = filterLogs(logs, options, merged.excludeAdmin, merged.excludeBots);
    const pageviews = filteredLogs.filter((log) => log.event_name === "pageview");
    const visitorStats = await buildVisitorStats(supabase, options, filteredLogs);
    const chartData = buildChartData(filteredLogs, merged.range);
    return {
        liveUsers: countLiveUsers(filteredLogs),
        totalPageviews: pageviews.length,
        uniqueVisitors: uniqueVisitorIds(filteredLogs).size,
        uniquePages: new Set(pageviews.map((log) => log.path)).size,
        chartData,
        recentEvents: filteredLogs.slice(0, 50),
        abResults: buildAbResults(filteredLogs),
        visitorStats,
    };
}
export async function getAnalyticsEmailVisitors(options, params = {}) {
    const data = await getAnalyticsDashboardData(options, params);
    return {
        emailVisitorStats: data.visitorStats.filter((visitor) => {
            return Boolean(visitor.email || visitor.sid || visitor.cid || visitor.classification?.emailAttributed);
        }),
    };
}
export async function getAnalyticsVisitorHistory(options, params) {
    const supabase = createDashboardSupabaseClient(options);
    const range = params.range ?? "7d";
    const logs = await fetchAnalyticsLogs(supabase, options, range, options.maxLogs ?? 5000);
    const filteredLogs = filterLogs(logs, options, params.excludeAdmin ?? true, params.excludeBots ?? true).filter((log) => {
        const key = visitorKeyForLog(log);
        return params.visitorKey ? key === params.visitorKey : log.ip_address === params.ip;
    });
    const ordered = [...filteredLogs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const pageviews = ordered.filter((log) => log.event_name === "pageview");
    const leaves = ordered.filter((log) => log.event_name === "page_leave");
    const visits = pageviews.map((pageview, index) => {
        const pageviewAt = new Date(pageview.created_at).getTime();
        const nextPageviewAt = index < pageviews.length - 1
            ? new Date(pageviews[index + 1].created_at).getTime()
            : Number.POSITIVE_INFINITY;
        const leave = leaves.find((event) => {
            const leaveAt = new Date(event.created_at).getTime();
            return event.path === pageview.path && leaveAt >= pageviewAt && leaveAt < nextPageviewAt;
        });
        const durationSeconds = numberFromMetadata(leave?.metadata, "duration_seconds") ??
            (Number.isFinite(nextPageviewAt) ? Math.round((nextPageviewAt - pageviewAt) / 1000) : null);
        return {
            path: pageview.path,
            visited_at: pageview.created_at,
            duration_seconds: durationSeconds !== null && durationSeconds > 7200 ? null : durationSeconds,
            metadata: pageview.metadata ?? null,
        };
    });
    const geoSource = [...ordered]
        .reverse()
        .find((log) => log.country || log.city || log.region || log.metadata?.city);
    return {
        visits,
        total_pageviews: pageviews.length,
        first_seen: pageviews[0]?.created_at ?? null,
        last_seen: pageviews[pageviews.length - 1]?.created_at ?? null,
        geo: {
            country: geoSource?.country ?? null,
            city: geoSource?.city ?? asString(geoSource?.metadata?.city) ?? null,
            region: geoSource?.region ?? asString(geoSource?.metadata?.region) ?? null,
        },
        classification: classifyLogs(ordered),
    };
}
export function createDashboardSupabaseClient(options) {
    return createClient(options.supabaseUrl, options.supabaseServiceRoleKey, {
        auth: { persistSession: false },
    });
}
async function fetchAnalyticsLogs(supabase, options, range, limit) {
    let query = analyticsTable(supabase, options)
        .select("id, created_at, event_name, path, ip_address, country, city, region, session_id, anonymous_id, tracker_version, user_agent, metadata")
        .order("created_at", { ascending: false })
        .limit(Math.min(limit, options.maxLogs ?? 5000));
    const start = rangeStart(range);
    if (start)
        query = query.gte("created_at", start.toISOString());
    const { data, error } = await query;
    if (error)
        throw error;
    return (data ?? []);
}
async function buildVisitorStats(supabase, options, logs) {
    const ipEmailMap = await fetchIpEmailMap(supabase, options);
    const grouped = new Map();
    for (const log of logs) {
        const key = visitorKeyForLog(log);
        const group = grouped.get(key) ?? [];
        group.push(log);
        grouped.set(key, group);
    }
    return Array.from(grouped.entries())
        .map(([visitorKey, visitorLogs]) => {
        const newest = visitorLogs[0];
        const oldestSource = [...visitorLogs].reverse().find(sourceForLog);
        const pageviews = visitorLogs.filter((log) => log.event_name === "pageview");
        const email = firstMetadataString(visitorLogs, "email") ??
            (newest.ip_address ? ipEmailMap.get(newest.ip_address) : undefined);
        const sid = firstMetadataString(visitorLogs, "sid");
        const cid = firstMetadataString(visitorLogs, "cid");
        return {
            visitorKey,
            ip: newest.ip_address ?? "unknown",
            count: pageviews.length,
            lastPath: newest.path,
            lastSeen: newest.created_at,
            country: newest.country ?? "Unknown",
            city: newest.city ?? asString(newest.metadata?.city) ?? null,
            region: newest.region ?? asString(newest.metadata?.region) ?? null,
            device: deviceFromUserAgent(newest.user_agent),
            email,
            sid,
            cid,
            source: oldestSource ? sourceForLog(oldestSource) : undefined,
            sourceUrl: sourceUrlForLog(oldestSource),
            totalTimeSeconds: totalDurationSeconds(visitorLogs),
            journey_id: firstMetadataString(visitorLogs, "journey_id"),
            classification: classifyLogs(visitorLogs),
        };
    })
        .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
}
async function fetchIpEmailMap(supabase, options) {
    const tableName = options.ipEmailMapTableName ?? "ip_email_map";
    const schema = analyticsSchema(options);
    const map = new Map();
    const { data, error } = await analyticsTableByName(supabase, schema, tableName).select("ip_address, email");
    if (error)
        return map;
    for (const row of data ?? []) {
        const ip = asString(row.ip_address);
        const email = asString(row.email);
        if (ip && email)
            map.set(ip, email);
    }
    return map;
}
function analyticsTable(supabase, options) {
    const tableName = options.tableName ?? "analytics_logs";
    const schema = analyticsSchema(options);
    return analyticsTableByName(supabase, schema, tableName);
}
function analyticsTableByName(supabase, schema, tableName) {
    const client = supabase;
    return schema ? client.schema(schema).from(tableName) : client.from(tableName);
}
function analyticsSchema(options) {
    return options.schema ?? (options.business ? analyticsSchemaForBusiness(options.business) : undefined);
}
function parseDashboardQuery(request) {
    const searchParams = new URL(request.url).searchParams;
    const range = parseRange(searchParams.get("range"));
    const visitorLimit = Math.min(Number.parseInt(searchParams.get("visitor_limit") ?? searchParams.get("limit") ?? "1000", 10) ||
        1000, 5000);
    return {
        range,
        excludeAdmin: searchParams.get("exclude_admin") !== "false",
        excludeBots: searchParams.get("exclude_bots") !== "false",
        visitorLimit,
    };
}
function withDefaultParams(params) {
    return {
        range: params.range ?? "7d",
        excludeAdmin: params.excludeAdmin ?? true,
        excludeBots: params.excludeBots ?? true,
        visitorLimit: params.visitorLimit ?? 1000,
    };
}
function parseRange(value) {
    if (value === "24h" || value === "7d" || value === "30d" || value === "all")
        return value;
    return "7d";
}
function rangeStart(range) {
    const now = new Date();
    if (range === "24h")
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (range === "7d")
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (range === "30d")
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return null;
}
function filterLogs(logs, options, excludeAdmin, excludeBots) {
    return logs.filter((log) => {
        if (excludeAdmin && isAdminIp(log.ip_address, options.adminIps ?? []))
            return false;
        if (excludeBots) {
            const result = classifyLogs([log]);
            if (result.botLikely || result.classification === "bot_likely")
                return false;
        }
        return true;
    });
}
function isAdminIp(ip, adminIps) {
    if (!ip)
        return false;
    const stripped = ip.replace(/^::ffff:/i, "");
    return adminIps.includes(ip) || adminIps.includes(stripped);
}
function classifyLogs(logs) {
    return classifyVisit(logs.map((log) => ({
        event_name: log.event_name,
        path: log.path,
        created_at: log.created_at,
        session_id: log.session_id,
        anonymous_id: log.anonymous_id,
        user_agent: log.user_agent,
        metadata: log.metadata ?? {},
    })));
}
function visitorKeyForLog(log) {
    const email = asString(log.metadata?.email);
    const sid = asString(log.metadata?.sid);
    const identity = email ?? sid ?? log.session_id ?? log.anonymous_id ?? "";
    return `${log.ip_address ?? "unknown"}::${identity}`;
}
function uniqueVisitorIds(logs) {
    return new Set(logs.map(visitorKeyForLog));
}
function countLiveUsers(logs) {
    const threshold = Date.now() - 5 * 60 * 1000;
    return uniqueVisitorIds(logs.filter((log) => new Date(log.created_at).getTime() >= threshold)).size;
}
function buildChartData(logs, range) {
    const buckets = new Map();
    const ordered = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (const log of ordered) {
        const name = bucketName(log.created_at, range);
        const bucket = buckets.get(name) ?? [];
        bucket.push(log);
        buckets.set(name, bucket);
    }
    return Array.from(buckets.entries()).map(([name, bucketLogs]) => {
        const pageviews = bucketLogs.filter((log) => log.event_name === "pageview");
        const visitors = uniqueVisitorIds(bucketLogs).size;
        return {
            name,
            visitors,
            pageviews: pageviews.length,
            unique_pages: new Set(pageviews.map((log) => log.path)).size,
            avg_per_user: visitors > 0 ? Number((pageviews.length / visitors).toFixed(1)) : 0,
        };
    });
}
function bucketName(value, range) {
    const date = new Date(value);
    if (range === "24h") {
        return date.toLocaleTimeString([], { hour: "numeric" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
function buildAbResults(logs) {
    const variants = new Map();
    for (const log of logs) {
        const variant = asString(log.metadata?.checkout_ab) ?? asString(log.metadata?.checkout_source);
        if (!variant)
            continue;
        const entry = variants.get(variant) ?? { visitors: new Set(), conversions: 0 };
        entry.visitors.add(visitorKeyForLog(log));
        if (log.event_name === "purchase")
            entry.conversions += 1;
        variants.set(variant, entry);
    }
    return Array.from(variants.entries()).map(([variant, entry]) => ({
        variant,
        visitors: entry.visitors.size,
        conversions: entry.conversions,
        conversion_rate: entry.visitors.size > 0 ? Number(((entry.conversions / entry.visitors.size) * 100).toFixed(2)) : 0,
    }));
}
function firstMetadataString(logs, key) {
    for (const log of logs) {
        const value = asString(log.metadata?.[key]);
        if (value)
            return value;
    }
    return undefined;
}
function sourceForLog(log) {
    if (!log?.metadata)
        return undefined;
    const utmSource = asString(log.metadata.utm_source);
    if (utmSource) {
        const parts = [`utm_source=${utmSource}`];
        const medium = asString(log.metadata.utm_medium);
        const campaign = asString(log.metadata.utm_campaign);
        if (medium)
            parts.push(`utm_medium=${medium}`);
        if (campaign)
            parts.push(`utm_campaign=${campaign}`);
        return parts.join("&");
    }
    const referrer = asString(log.metadata.referrer);
    if (!referrer)
        return undefined;
    try {
        const url = new URL(referrer);
        return url.hostname.replace(/^www\./, "");
    }
    catch {
        return referrer;
    }
}
function sourceUrlForLog(log) {
    return asString(log?.metadata?.referrer);
}
function totalDurationSeconds(logs) {
    return logs.reduce((total, log) => {
        const duration = numberFromMetadata(log.metadata, "duration_seconds");
        if (log.event_name !== "page_leave" || duration === null || duration <= 0 || duration >= 3600) {
            return total;
        }
        return total + duration;
    }, 0);
}
function numberFromMetadata(metadata, key) {
    const value = metadata?.[key];
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return null;
}
function deviceFromUserAgent(userAgent) {
    const ua = userAgent ?? "";
    if (!ua)
        return "Unknown";
    if (/bot|crawl|spider|slurp|facebookexternalhit|Twitterbot|LinkedInBot/i.test(ua))
        return "Bot";
    if (/iPad|tablet|Kindle|Silk|PlayBook/i.test(ua))
        return "Tablet";
    if (/Mobile|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)) {
        return "Mobile";
    }
    return "Desktop";
}
function json(data, status = 200) {
    return Response.json(data, {
        status,
        headers: NO_CACHE_HEADERS,
    });
}
//# sourceMappingURL=dashboard-server.js.map