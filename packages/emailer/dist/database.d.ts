import type { EmailEngineEnv } from "./schema.js";
export type EmailerSupabase = any;
export type EmailEngineOptions = Partial<EmailEngineEnv> & {
    fromDomainTrackingBaseUrls?: Record<string, string>;
};
export declare function resolveEmailEngineEnv(options?: EmailEngineOptions): EmailEngineEnv;
export declare function createEmailSupabaseClient(options?: EmailEngineOptions): EmailerSupabase;
export declare function emailJson(data: unknown, status?: number): Response;
export declare function emailError(error: string, status?: number, details?: unknown): Response;
export declare function readJson(request: Request): Promise<unknown>;
export declare function requireAgentAuth(request: Request, options?: EmailEngineOptions): Response | null;
//# sourceMappingURL=database.d.ts.map