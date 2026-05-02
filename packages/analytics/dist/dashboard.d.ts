import type { AnalyticsDashboardRange, AnalyticsDashboardTab } from "./dashboard-types.js";
export type AnalyticsDashboardProps = {
    title?: string;
    accentLabel?: string;
    apiBasePath?: string;
    initialRange?: AnalyticsDashboardRange;
    initialTab?: AnalyticsDashboardTab;
    enabledTabs?: AnalyticsDashboardTab[];
    refreshMs?: number;
};
export declare function AnalyticsDashboard({ title, accentLabel, apiBasePath, initialRange, initialTab, enabledTabs, refreshMs, }: AnalyticsDashboardProps): import("react/jsx-runtime").JSX.Element;
export default AnalyticsDashboard;
//# sourceMappingURL=dashboard.d.ts.map