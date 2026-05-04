export type KnownEmailWorkspace = "dreamplay_marketing" | "dreamplay_support" | "musicalbasics" | "crossover" | "concert_marketing";
export type EmailWorkspace = KnownEmailWorkspace | (string & {});
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = {
    [key: string]: JsonValue;
};
export type SubscribePayload = {
    email: string;
    first_name?: string;
    last_name?: string;
    tags?: string[];
    workspace?: EmailWorkspace;
    city?: string;
    country?: string;
    ip_address?: string;
    gdpr_consent?: boolean;
    temp_session_id?: string;
    metadata?: JsonObject;
};
export type SubscribeResponse = {
    success: boolean;
    id?: string;
    error?: string;
    status?: number;
};
export type HeaderReader = {
    get(name: string): string | null;
};
export type EmailCampaignStatus = "draft" | "scheduled" | "sending" | "completed" | "deleted";
export type EmailType = "campaign" | "automated";
export type ClickTrackingMode = "append" | "redirect";
export type EmailEngineEnv = {
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    resendApiKey?: string;
    resendFromEmail?: string;
    agentApiKey?: string;
    appUrl?: string;
    trackingBaseUrl?: string;
};
export type EmailCampaignRow = {
    id: string;
    name: string;
    subject_line?: string | null;
    html_content?: string | null;
    variable_values?: JsonObject | null;
    status?: string | null;
    email_type?: string | null;
    is_template?: boolean | null;
    parent_template_id?: string | null;
    workspace?: string | null;
    total_recipients?: number | null;
    total_opens?: number | null;
    total_clicks?: number | null;
    created_at?: string | null;
    updated_at?: string | null;
};
export type EmailSubscriberRow = {
    id: string;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    status?: string | null;
    tags?: string[] | null;
    workspace?: string | null;
    [key: string]: unknown;
};
export type SendEmailCampaignPayload = {
    campaignId: string;
    fromName?: string | null;
    fromEmail?: string | null;
    clickTracking?: boolean;
    clickTrackingMode?: ClickTrackingMode;
    openTracking?: boolean;
    resendClickTracking?: boolean;
    resendOpenTracking?: boolean;
    overrideSubscriberIds?: string[];
    triggeredBy?: string;
    sync?: boolean;
};
export type SendEmailCampaignResult = {
    done: boolean;
    stats: {
        sent: number;
        failed: number;
        total: number;
    };
    logLines: number;
    sendLogId?: string | null;
    sendLogError?: string | null;
};
export declare const DEFAULT_SUBSCRIBE_ENDPOINT = "https://email.dreamplaypianos.com/api/webhooks/subscribe";
export declare const EMAIL_WORKSPACES: ["dreamplay_marketing", "dreamplay_support", "musicalbasics", "crossover", "concert_marketing"];
export declare function normalizeEmail(value: string): string;
export declare function normalizeTags(tags: string[] | undefined): string[];
export declare function assertValidSubscribePayload(payload: SubscribePayload): void;
export declare function metadataFromHeaders(headers: HeaderReader): Partial<SubscribePayload>;
//# sourceMappingURL=schema.d.ts.map