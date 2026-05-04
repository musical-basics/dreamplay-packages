export class AnalyticsSchemaNotExposedError extends Error {
    schema;
    fix;
    constructor(schema, supabaseUrl) {
        super(`[@dreamplay/analytics] schema '${schema}' is not exposed in PostgREST. Add it in Supabase \u2192 Project Settings \u2192 Data API \u2192 Exposed schemas.`);
        this.name = "AnalyticsSchemaNotExposedError";
        this.schema = schema;
        this.fix = supabaseDataApiSettingsUrl(supabaseUrl);
    }
}
export function createAnalyticsSchemaExposureChecker(options) {
    let checked = false;
    let pending = null;
    return async function ensureAnalyticsSchemaExposed(supabase) {
        if (checked)
            return;
        pending ??= checkAnalyticsSchemaExposure(supabase, options);
        try {
            await pending;
            checked = true;
        }
        catch (error) {
            pending = null;
            throw error;
        }
    };
}
export function isAnalyticsSchemaNotExposedError(error) {
    return error instanceof AnalyticsSchemaNotExposedError;
}
async function checkAnalyticsSchemaExposure(supabase, options) {
    const { error } = await supabase
        .schema(options.schema)
        .from(options.tableName ?? "analytics_logs")
        .select("id", { count: "exact", head: true })
        .limit(1);
    if (isPostgrestSchemaNotExposedError(error)) {
        throw new AnalyticsSchemaNotExposedError(options.schema, options.supabaseUrl);
    }
    if (error)
        throw error;
}
function isPostgrestSchemaNotExposedError(error) {
    return isRecord(error) && error.code === "PGRST106";
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function supabaseDataApiSettingsUrl(supabaseUrl) {
    const fallback = "https://supabase.com/dashboard/project/_/settings/api";
    if (!supabaseUrl)
        return fallback;
    try {
        const hostname = new URL(supabaseUrl).hostname;
        const projectRef = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)?.[1];
        return projectRef
            ? `https://supabase.com/dashboard/project/${projectRef}/settings/api`
            : fallback;
    }
    catch {
        return fallback;
    }
}
//# sourceMappingURL=schema-check.js.map