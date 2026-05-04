"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useCallback, useEffect, useMemo, useState } from "react";
const DEFAULT_WORKSPACES = [
    "dreamplay_marketing",
    "dreamplay_support",
    "musicalbasics",
    "crossover",
    "concert_marketing",
];
export function EmailerDashboard({ apiBasePath = "/api/emailer/editor", initialWorkspace = "dreamplay_marketing", workspaces = DEFAULT_WORKSPACES, title = "Emailer", }) {
    const [workspace, setWorkspace] = useState(initialWorkspace);
    const [campaigns, setCampaigns] = useState([]);
    const [subscribers, setSubscribers] = useState([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState("");
    const [campaignName, setCampaignName] = useState("");
    const [subject, setSubject] = useState("");
    const [html, setHtml] = useState(sampleHtml());
    const [targetTag, setTargetTag] = useState("");
    const [status, setStatus] = useState("Ready.");
    const [busy, setBusy] = useState(false);
    const endpoint = useMemo(() => `${apiBasePath}/${workspace}`, [apiBasePath, workspace]);
    const refresh = useCallback(async () => {
        setBusy(true);
        try {
            const [campaignRes, subscriberRes] = await Promise.all([
                fetch(`${endpoint}/campaigns?limit=50&include_html=false`, { cache: "no-store" }),
                fetch(`${endpoint}/subscribers?limit=50&status=active`, { cache: "no-store" }),
            ]);
            const campaignJson = await readJsonOrThrow(campaignRes);
            const subscriberJson = await readJsonOrThrow(subscriberRes);
            setCampaigns(campaignJson.data ?? []);
            setSubscribers(subscriberJson.data ?? []);
            setStatus("Loaded.");
        }
        catch (error) {
            setStatus(error instanceof Error ? error.message : "Failed to load emailer data");
        }
        finally {
            setBusy(false);
        }
    }, [endpoint]);
    useEffect(() => {
        void refresh();
    }, [refresh]);
    async function saveCampaign() {
        setBusy(true);
        try {
            const body = {
                name: campaignName || "Untitled campaign",
                subject_line: subject,
                html_content: html,
                status: "draft",
                email_type: "campaign",
                is_template: false,
                variable_values: targetTag ? { target_tag: targetTag } : {},
            };
            const res = await fetch(selectedCampaignId ? `${endpoint}/campaigns/${selectedCampaignId}` : `${endpoint}/campaigns`, {
                method: selectedCampaignId ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await readJsonOrThrow(res);
            const saved = json.data;
            setSelectedCampaignId(saved.id);
            setCampaignName(saved.name);
            setStatus("Campaign saved.");
            await refresh();
        }
        catch (error) {
            setStatus(error instanceof Error ? error.message : "Save failed");
        }
        finally {
            setBusy(false);
        }
    }
    async function loadCampaign(id) {
        setBusy(true);
        try {
            const res = await fetch(`${endpoint}/campaigns/${id}?include_html=true`, { cache: "no-store" });
            const json = await readJsonOrThrow(res);
            const campaign = json.data;
            setSelectedCampaignId(campaign.id);
            setCampaignName(campaign.name ?? "");
            setSubject(campaign.subject_line ?? "");
            setHtml(campaign.html_content ?? sampleHtml());
            setTargetTag(typeof campaign.variable_values?.target_tag === "string" ? campaign.variable_values.target_tag : "");
            setStatus("Campaign loaded.");
        }
        catch (error) {
            setStatus(error instanceof Error ? error.message : "Load failed");
        }
        finally {
            setBusy(false);
        }
    }
    async function sendCampaign() {
        if (!selectedCampaignId) {
            setStatus("Save or select a campaign before sending.");
            return;
        }
        setBusy(true);
        try {
            const res = await fetch(`${endpoint}/campaigns/${selectedCampaignId}/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clickTrackingMode: "append" }),
            });
            await readJsonOrThrow(res);
            setStatus("Send completed.");
            await refresh();
        }
        catch (error) {
            setStatus(error instanceof Error ? error.message : "Send failed");
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("div", { style: styles.shell, children: [_jsxs("header", { style: styles.header, children: [_jsxs("div", { children: [_jsx("h1", { style: styles.title, children: title }), _jsx("p", { style: styles.muted, children: status })] }), _jsxs("div", { style: styles.controls, children: [_jsx("select", { value: workspace, onChange: (event) => setWorkspace(event.target.value), style: styles.input, children: workspaces.map((item) => _jsx("option", { value: item, children: item }, item)) }), _jsx("button", { type: "button", onClick: () => void refresh(), disabled: busy, style: styles.button, children: "Refresh" })] })] }), _jsxs("section", { style: styles.grid, children: [_jsxs("div", { style: styles.panel, children: [_jsx("h2", { style: styles.heading, children: "Campaigns" }), _jsxs("div", { style: styles.list, children: [campaigns.map((campaign) => (_jsxs("button", { type: "button", onClick: () => void loadCampaign(campaign.id), style: {
                                            ...styles.rowButton,
                                            ...(selectedCampaignId === campaign.id ? styles.rowButtonActive : {}),
                                        }, children: [_jsx("strong", { children: campaign.name }), _jsxs("span", { children: [campaign.status ?? "draft", " \u00B7 ", campaign.total_recipients ?? 0, " sent"] })] }, campaign.id))), campaigns.length === 0 && _jsx("p", { style: styles.muted, children: "No campaigns yet." })] })] }), _jsxs("div", { style: styles.panel, children: [_jsx("h2", { style: styles.heading, children: "Editor" }), _jsx("label", { style: styles.label, children: "Name" }), _jsx("input", { value: campaignName, onChange: (event) => setCampaignName(event.target.value), style: styles.input }), _jsx("label", { style: styles.label, children: "Subject" }), _jsx("input", { value: subject, onChange: (event) => setSubject(event.target.value), style: styles.input }), _jsx("label", { style: styles.label, children: "Target Tag" }), _jsx("input", { value: targetTag, onChange: (event) => setTargetTag(event.target.value), style: styles.input }), _jsx("label", { style: styles.label, children: "HTML" }), _jsx("textarea", { value: html, onChange: (event) => setHtml(event.target.value), style: styles.textarea }), _jsxs("div", { style: styles.actions, children: [_jsx("button", { type: "button", onClick: () => void saveCampaign(), disabled: busy, style: styles.button, children: "Save" }), _jsx("button", { type: "button", onClick: () => void sendCampaign(), disabled: busy || !selectedCampaignId, style: styles.primaryButton, children: "Send" })] })] }), _jsxs("div", { style: styles.panel, children: [_jsx("h2", { style: styles.heading, children: "Active Subscribers" }), _jsxs("div", { style: styles.list, children: [subscribers.map((subscriber) => (_jsxs("div", { style: styles.subscriberRow, children: [_jsx("strong", { children: subscriber.email }), _jsx("span", { children: subscriber.tags?.join(", ") || subscriber.status || "active" })] }, subscriber.id))), subscribers.length === 0 && _jsx("p", { style: styles.muted, children: "No active subscribers." })] })] })] })] }));
}
export default EmailerDashboard;
async function readJsonOrThrow(response) {
    const json = await response.json().catch(() => null);
    if (!response.ok)
        throw new Error(json?.error ?? `Request failed: ${response.status}`);
    return json ?? {};
}
function sampleHtml() {
    return `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:24px;">
    <table role="presentation" width="100%" style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;">
      <tr><td style="padding:32px;">
        <h1>Hello {{first_name}}</h1>
        <p>Write your campaign here.</p>
        <p><a href="{{main_cta_url}}">Read more</a></p>
      </td></tr>
    </table>
  </body>
</html>`;
}
const styles = {
    shell: {
        minHeight: "100vh",
        background: "#0f1115",
        color: "#f5f5f5",
        padding: 24,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        alignItems: "center",
        marginBottom: 20,
        flexWrap: "wrap",
    },
    title: { margin: 0, fontSize: 28 },
    muted: { color: "#9ca3af", margin: "4px 0" },
    controls: { display: "flex", gap: 8, alignItems: "center" },
    grid: {
        display: "grid",
        gridTemplateColumns: "minmax(220px, .8fr) minmax(320px, 1.4fr) minmax(220px, .8fr)",
        gap: 16,
        alignItems: "start",
    },
    panel: {
        background: "#181b22",
        border: "1px solid #2b303b",
        borderRadius: 8,
        padding: 16,
    },
    heading: { fontSize: 16, margin: "0 0 12px" },
    list: { display: "grid", gap: 8 },
    rowButton: {
        textAlign: "left",
        display: "grid",
        gap: 4,
        border: "1px solid #2b303b",
        background: "#11141a",
        color: "#f5f5f5",
        borderRadius: 6,
        padding: 10,
        cursor: "pointer",
    },
    rowButtonActive: { borderColor: "#60a5fa", background: "#172033" },
    subscriberRow: {
        display: "grid",
        gap: 4,
        borderBottom: "1px solid #2b303b",
        padding: "8px 0",
    },
    label: { display: "block", color: "#9ca3af", fontSize: 12, margin: "12px 0 6px" },
    input: {
        width: "100%",
        background: "#0f1115",
        color: "#f5f5f5",
        border: "1px solid #2b303b",
        borderRadius: 6,
        padding: "9px 10px",
    },
    textarea: {
        width: "100%",
        minHeight: 280,
        background: "#0f1115",
        color: "#f5f5f5",
        border: "1px solid #2b303b",
        borderRadius: 6,
        padding: 10,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12,
    },
    actions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 },
    button: {
        border: "1px solid #374151",
        background: "#1f2937",
        color: "#fff",
        borderRadius: 6,
        padding: "9px 12px",
        cursor: "pointer",
    },
    primaryButton: {
        border: "1px solid #2563eb",
        background: "#2563eb",
        color: "#fff",
        borderRadius: 6,
        padding: "9px 12px",
        cursor: "pointer",
    },
};
//# sourceMappingURL=dashboard.js.map