import type { EmailSubscriberRow, JsonObject } from "./schema.js";
export declare const STANDARD_TAGS: readonly ["first_name", "last_name", "email", "subscriber_id", "location_city", "location_country", "discount_code", "unsubscribe_url", "unsubscribe_link", "unsubscribe_link_url"];
export declare function renderTemplate(html: string, assets: Record<string, string>, subscriberTags?: string[]): string;
export declare function injectPreheader(html: string, previewText: unknown): string;
export declare function applyAllMergeTags(html: string, subscriber: EmailSubscriberRow, dynamicVars?: Record<string, unknown>): Promise<string>;
export declare function applyAllMergeTagsWithLog(html: string, subscriber: EmailSubscriberRow, dynamicVars?: Record<string, unknown>): Promise<{
    html: string;
    log: Array<Record<string, unknown>>;
}>;
export declare function globalTemplateVars(variableValues: JsonObject | null | undefined): Record<string, string>;
//# sourceMappingURL=template.d.ts.map