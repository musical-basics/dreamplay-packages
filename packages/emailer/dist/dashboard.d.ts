import type { EmailWorkspace } from "./schema.js";
export type EmailerDashboardProps = {
    apiBasePath?: string;
    initialWorkspace?: EmailWorkspace;
    workspaces?: readonly EmailWorkspace[];
    title?: string;
};
export declare function EmailerDashboard({ apiBasePath, initialWorkspace, workspaces, title, }: EmailerDashboardProps): import("react/jsx-runtime").JSX.Element;
export default EmailerDashboard;
//# sourceMappingURL=dashboard.d.ts.map