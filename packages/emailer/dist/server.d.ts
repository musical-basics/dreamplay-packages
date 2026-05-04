import { type EmailerConfig } from "./client.js";
import { type EmailEngineOptions } from "./database.js";
import { type HeaderReader, type SubscribePayload, type SubscribeResponse } from "./schema.js";
export type CorsOptions = {
    allowedOrigins: string[];
    allowVercelPreviews?: boolean;
    allowLocalhost?: boolean;
    methods?: string;
    headers?: string;
};
export type EmailSubscribeHandlerOptions = EmailerConfig & EmailEngineOptions & {
    cors?: CorsOptions;
};
export declare function subscribeWithHeaders(payload: SubscribePayload, headers: HeaderReader, options?: EmailSubscribeHandlerOptions): Promise<SubscribeResponse>;
export declare function createEmailSubscribeHandler(options?: EmailSubscribeHandlerOptions): (request: Request) => Promise<Response>;
export declare function subscribeToEmailerDatabase(payload: SubscribePayload, options?: EmailSubscribeHandlerOptions): Promise<SubscribeResponse>;
export declare function createEmailSubscribeOptionsHandler(options?: EmailSubscribeHandlerOptions): (request: Request) => Promise<Response>;
export declare function corsHeaders(origin: string | null, options: CorsOptions): Record<string, string>;
export declare function isAllowedOrigin(origin: string | null, options: CorsOptions): boolean;
//# sourceMappingURL=server.d.ts.map