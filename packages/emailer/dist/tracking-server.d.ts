import { type EmailEngineOptions } from "./database.js";
export type TrackingBaseOptions = EmailEngineOptions & {
    fromDomainTrackingBaseUrls?: Record<string, string>;
};
export declare const DEFAULT_FROM_DOMAIN_TRACKING_BASE_URLS: Record<string, string>;
export declare function pickTrackingBaseUrl(fromEmail: string | null | undefined, options?: TrackingBaseOptions): string;
export declare function appendEmailAttributionToLinks(html: string, input: {
    subscriberId: string;
    campaignId: string;
    clickTrackingMode?: "append" | "redirect";
    trackingBaseUrl?: string;
}): string;
export declare function injectOpenPixel(html: string, input: {
    subscriberId: string;
    campaignId: string;
    trackingBaseUrl: string;
}): string;
export declare function createEmailOpenTrackingHandler(options?: EmailEngineOptions): (request: Request) => Promise<Response>;
export declare function createEmailClickTrackingHandler(options?: EmailEngineOptions): (request: Request) => Promise<Response>;
export declare function createEmailTrackingHealthHandler(options?: EmailEngineOptions): () => Response;
//# sourceMappingURL=tracking-server.d.ts.map