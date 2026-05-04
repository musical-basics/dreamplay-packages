import { createClient } from "@supabase/supabase-js";
import type { EmailEngineEnv } from "./schema.js";

export type EmailerSupabase = any;

export type EmailEngineOptions = Partial<EmailEngineEnv> & {
  fromDomainTrackingBaseUrls?: Record<string, string>;
};

export function resolveEmailEngineEnv(options: EmailEngineOptions = {}): EmailEngineEnv {
  const supabaseUrl = options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey =
    options.supabaseServiceRoleKey ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("Missing email Supabase URL");
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

export function createEmailSupabaseClient(options: EmailEngineOptions = {}): EmailerSupabase {
  const env = resolveEmailEngineEnv(options);
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as EmailerSupabase;
}

export function emailJson(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function emailError(error: string, status = 400, details?: unknown): Response {
  return Response.json({ error, details }, { status });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function requireAgentAuth(
  request: Request,
  options: EmailEngineOptions = {}
): Response | null {
  const expected = options.agentApiKey ?? process.env.AGENT_API_KEY;
  const actual = request.headers.get("authorization");

  if (!expected) return emailError("AGENT_API_KEY is not configured", 503);
  if (actual !== `Bearer ${expected}`) return emailError("Unauthorized", 401);

  return null;
}
