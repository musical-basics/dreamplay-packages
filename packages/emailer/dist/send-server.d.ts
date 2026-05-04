import { type EmailEngineOptions } from "./database.js";
import type { SendEmailCampaignPayload, SendEmailCampaignResult } from "./schema.js";
export type SendEmailCampaignOptions = EmailEngineOptions & {
    rateLimitMs?: number;
    appendUnsubscribeFooter?: boolean;
    fromDomainTrackingBaseUrls?: Record<string, string>;
};
export declare function sendEmailCampaign(payload: SendEmailCampaignPayload, options?: SendEmailCampaignOptions): Promise<SendEmailCampaignResult>;
export declare function createEmailSendHandler(options?: SendEmailCampaignOptions): (request: Request) => Promise<Response>;
//# sourceMappingURL=send-server.d.ts.map