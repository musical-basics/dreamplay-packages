import { createClient } from "@supabase/supabase-js";
export function resolveEmailEngineEnv(options = {}) {
    const supabaseUrl = options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = options.supabaseServiceRoleKey ??
        process.env.SUPABASE_SERVICE_KEY ??
        process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl)
        throw new Error("Missing email Supabase URL");
    if (!supabaseServiceRoleKey) {
        throw new Error("Missing email Supabase service role key");
    }
    return {
        supabaseUrl,
        supabaseServiceRoleKey,
        resendApiKey: options.resendApiKey ?? process.env.RESEND_API_KEY,
        resendFromEmail: options.resendFromEmail ?? process.env.RESEND_FROM_EMAIL,
        agentApiKey: options.agentApiKey ?? process.env.AGENT_API_KEY,
        appUrl: options.appUrl ?? process.env.NEXT_PUBLIC_APP_URL,
        trackingBaseUrl: options.trackingBaseUrl ?? process.env.TRACKING_BASE_URL,
    };
}
export function createEmailSupabaseClient(options = {}) {
    const env = resolveEmailEngineEnv(options);
    return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
export function emailJson(data, status = 200) {
    return Response.json(data, { status });
}
export function emailError(error, status = 400, details) {
    return Response.json({ error, details }, { status });
}
export async function readJson(request) {
    try {
        return await request.json();
    }
    catch {
        return {};
    }
}
export function requireAgentAuth(request, options = {}) {
    const expected = options.agentApiKey ?? process.env.AGENT_API_KEY;
    const actual = request.headers.get("authorization");
    if (!expected)
        return emailError("AGENT_API_KEY is not configured", 503);
    if (actual !== `Bearer ${expected}`)
        return emailError("Unauthorized", 401);
    return null;
}
//# sourceMappingURL=database.js.map