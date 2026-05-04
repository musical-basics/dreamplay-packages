"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { EmailWorkspace } from "./schema.js";

export type EmailerDashboardProps = {
  apiBasePath?: string;
  initialWorkspace?: EmailWorkspace;
  workspaces?: readonly EmailWorkspace[];
  title?: string;
};

type CampaignListItem = {
  id: string;
  name: string;
  subject_line?: string | null;
  status?: string | null;
  is_template?: boolean | null;
  total_recipients?: number | null;
  updated_at?: string | null;
};

type SubscriberListItem = {
  id: string;
  email: string;
  first_name?: string | null;
  tags?: string[] | null;
  status?: string | null;
};

const DEFAULT_WORKSPACES = [
  "dreamplay_marketing",
  "dreamplay_support",
  "musicalbasics",
  "crossover",
  "concert_marketing",
] as const;

export function EmailerDashboard({
  apiBasePath = "/api/emailer/editor",
  initialWorkspace = "dreamplay_marketing",
  workspaces = DEFAULT_WORKSPACES,
  title = "Emailer",
}: EmailerDashboardProps) {
  const [workspace, setWorkspace] = useState<EmailWorkspace>(initialWorkspace);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [subscribers, setSubscribers] = useState<SubscriberListItem[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState(sampleHtml());
  const [targetTag, setTargetTag] = useState("");
  const [status, setStatus] = useState("Ready.");
  const [busy, setBusy] = useState(false);

  const endpoint = useMemo(
    () => `${apiBasePath}/${workspace}`,
    [apiBasePath, workspace]
  );

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [campaignRes, subscriberRes] = await Promise.all([
        fetch(`${endpoint}/campaigns?limit=50&include_html=false`, { cache: "no-store" }),
        fetch(`${endpoint}/subscribers?limit=50&status=active`, { cache: "no-store" }),
      ]);
      const campaignJson = await readJsonOrThrow(campaignRes);
      const subscriberJson = await readJsonOrThrow(subscriberRes);
      setCampaigns((campaignJson.data as CampaignListItem[]) ?? []);
      setSubscribers((subscriberJson.data as SubscriberListItem[]) ?? []);
      setStatus("Loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load emailer data");
    } finally {
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
      const res = await fetch(
        selectedCampaignId ? `${endpoint}/campaigns/${selectedCampaignId}` : `${endpoint}/campaigns`,
        {
          method: selectedCampaignId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await readJsonOrThrow(res);
      const saved = json.data as CampaignListItem;
      setSelectedCampaignId(saved.id);
      setCampaignName(saved.name);
      setStatus("Campaign saved.");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadCampaign(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`${endpoint}/campaigns/${id}?include_html=true`, { cache: "no-store" });
      const json = await readJsonOrThrow(res);
      const campaign = json.data as CampaignListItem & {
        html_content?: string | null;
        variable_values?: Record<string, unknown> | null;
      };
      setSelectedCampaignId(campaign.id);
      setCampaignName(campaign.name ?? "");
      setSubject(campaign.subject_line ?? "");
      setHtml(campaign.html_content ?? sampleHtml());
      setTargetTag(typeof campaign.variable_values?.target_tag === "string" ? campaign.variable_values.target_tag : "");
      setStatus("Campaign loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Load failed");
    } finally {
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
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>{title}</h1>
          <p style={styles.muted}>{status}</p>
        </div>
        <div style={styles.controls}>
          <select value={workspace} onChange={(event) => setWorkspace(event.target.value as EmailWorkspace)} style={styles.input}>
            {workspaces.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button type="button" onClick={() => void refresh()} disabled={busy} style={styles.button}>Refresh</button>
        </div>
      </header>

      <section style={styles.grid}>
        <div style={styles.panel}>
          <h2 style={styles.heading}>Campaigns</h2>
          <div style={styles.list}>
            {campaigns.map((campaign) => (
              <button
                type="button"
                key={campaign.id}
                onClick={() => void loadCampaign(campaign.id)}
                style={{
                  ...styles.rowButton,
                  ...(selectedCampaignId === campaign.id ? styles.rowButtonActive : {}),
                }}
              >
                <strong>{campaign.name}</strong>
                <span>{campaign.status ?? "draft"} · {campaign.total_recipients ?? 0} sent</span>
              </button>
            ))}
            {campaigns.length === 0 && <p style={styles.muted}>No campaigns yet.</p>}
          </div>
        </div>

        <div style={styles.panel}>
          <h2 style={styles.heading}>Editor</h2>
          <label style={styles.label}>Name</label>
          <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} style={styles.input} />
          <label style={styles.label}>Subject</label>
          <input value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.input} />
          <label style={styles.label}>Target Tag</label>
          <input value={targetTag} onChange={(event) => setTargetTag(event.target.value)} style={styles.input} />
          <label style={styles.label}>HTML</label>
          <textarea value={html} onChange={(event) => setHtml(event.target.value)} style={styles.textarea} />
          <div style={styles.actions}>
            <button type="button" onClick={() => void saveCampaign()} disabled={busy} style={styles.button}>Save</button>
            <button type="button" onClick={() => void sendCampaign()} disabled={busy || !selectedCampaignId} style={styles.primaryButton}>Send</button>
          </div>
        </div>

        <div style={styles.panel}>
          <h2 style={styles.heading}>Active Subscribers</h2>
          <div style={styles.list}>
            {subscribers.map((subscriber) => (
              <div key={subscriber.id} style={styles.subscriberRow}>
                <strong>{subscriber.email}</strong>
                <span>{subscriber.tags?.join(", ") || subscriber.status || "active"}</span>
              </div>
            ))}
            {subscribers.length === 0 && <p style={styles.muted}>No active subscribers.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

export default EmailerDashboard;

async function readJsonOrThrow(response: Response): Promise<{ data?: unknown; error?: string }> {
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error ?? `Request failed: ${response.status}`);
  return json ?? {};
}

function sampleHtml(): string {
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
    flexWrap: "wrap" as const,
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
    textAlign: "left" as const,
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
} satisfies Record<string, React.CSSProperties>;
