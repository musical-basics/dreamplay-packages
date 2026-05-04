import { DEFAULT_SUBSCRIBE_ENDPOINT, assertValidSubscribePayload, normalizeEmail, normalizeTags, } from "./schema.js";
export class EmailerRequestError extends Error {
    status;
    responseBody;
    constructor(status, message, responseBody) {
        super(message);
        this.name = "EmailerRequestError";
        this.status = status;
        this.responseBody = responseBody;
    }
}
export function createDreamplayEmailer(config = {}) {
    return {
        subscribe: (payload) => subscribeToEmailList(payload, config),
    };
}
export async function subscribeToEmailList(payload, config = {}) {
    const endpoint = endpointFromConfig(config.endpoint);
    const fetcher = config.fetcher ?? fetch;
    const body = buildSubscribePayload(payload, config);
    try {
        const response = await fetcher(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const responseBody = await readJson(response);
        if (!response.ok) {
            if (config.treatAlreadyExistsAsSuccess !== false && isAlreadyExistsStatus(response.status)) {
                return { success: true, status: response.status };
            }
            const message = errorMessageFromResponse(responseBody) ?? "Failed to subscribe";
            return { success: false, error: message, status: response.status };
        }
        const id = isRecord(responseBody) && typeof responseBody.id === "string"
            ? responseBody.id
            : undefined;
        return { success: true, id, status: response.status };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to subscribe",
        };
    }
}
export function buildSubscribePayload(payload, config = {}) {
    assertValidSubscribePayload(payload);
    return {
        ...payload,
        email: normalizeEmail(payload.email),
        first_name: payload.first_name ?? "",
        workspace: payload.workspace ?? config.workspace,
        tags: normalizeTags([...(config.defaultTags ?? []), ...(payload.tags ?? [])]),
    };
}
function endpointFromConfig(endpoint) {
    const configured = endpoint?.trim();
    return configured && configured.length > 0 ? configured : DEFAULT_SUBSCRIBE_ENDPOINT;
}
async function readJson(response) {
    try {
        return await response.json();
    }
    catch {
        return null;
    }
}
function isAlreadyExistsStatus(status) {
    return status === 400 || status === 409 || status === 422;
}
function errorMessageFromResponse(value) {
    if (!isRecord(value))
        return undefined;
    return typeof value.error === "string" ? value.error : undefined;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=client.js.map