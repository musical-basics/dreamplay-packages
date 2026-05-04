import { type EmailWorkspace, type SubscribePayload, type SubscribeResponse } from "./schema.js";
export type EmailerConfig = {
    endpoint?: string;
    workspace?: EmailWorkspace;
    defaultTags?: string[];
    treatAlreadyExistsAsSuccess?: boolean;
    fetcher?: typeof fetch;
};
export type DreamplayEmailer = {
    subscribe: (payload: SubscribePayload) => Promise<SubscribeResponse>;
};
export declare class EmailerRequestError extends Error {
    readonly status: number;
    readonly responseBody: unknown;
    constructor(status: number, message: string, responseBody: unknown);
}
export declare function createDreamplayEmailer(config?: EmailerConfig): DreamplayEmailer;
export declare function subscribeToEmailList(payload: SubscribePayload, config?: EmailerConfig): Promise<SubscribeResponse>;
export declare function buildSubscribePayload(payload: SubscribePayload, config?: Pick<EmailerConfig, "workspace" | "defaultTags">): SubscribePayload;
//# sourceMappingURL=client.d.ts.map