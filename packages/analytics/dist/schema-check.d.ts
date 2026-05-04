export type SchemaExposureCheckClient = {
    schema: (schema: string) => {
        from: (table: string) => {
            select: (columns: string, options?: {
                count?: "exact";
                head?: boolean;
            }) => {
                limit: (count: number) => Promise<{
                    error: unknown;
                }>;
            };
        };
    };
};
export type AnalyticsSchemaExposureCheckOptions = {
    schema: string;
    tableName?: string;
    supabaseUrl?: string;
};
export declare class AnalyticsSchemaNotExposedError extends Error {
    readonly schema: string;
    readonly fix: string;
    constructor(schema: string, supabaseUrl?: string);
}
export declare function createAnalyticsSchemaExposureChecker(options: AnalyticsSchemaExposureCheckOptions): (supabase: SchemaExposureCheckClient) => Promise<void>;
export declare function isAnalyticsSchemaNotExposedError(error: unknown): error is AnalyticsSchemaNotExposedError;
//# sourceMappingURL=schema-check.d.ts.map