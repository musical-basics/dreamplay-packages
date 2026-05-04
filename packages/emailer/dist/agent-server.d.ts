import { type SendEmailCampaignOptions } from "./send-server.js";
export type EmailAgentRouteContext = {
    params: Promise<{
        workspace: string;
        path?: string[];
    }>;
};
export type EmailAgentHandlerOptions = SendEmailCampaignOptions & {
    allowedWorkspaces?: readonly string[];
    dispatchSendEvent?: (event: {
        name: string;
        data: Record<string, unknown>;
    }) => Promise<unknown>;
};
export declare function createEmailAgentHandler(options?: EmailAgentHandlerOptions): (request: Request, context: EmailAgentRouteContext) => Promise<Response>;
export declare function createEmailEditorHandler(options?: EmailAgentHandlerOptions): (request: Request, context: EmailAgentRouteContext) => Promise<Response>;
//# sourceMappingURL=agent-server.d.ts.map