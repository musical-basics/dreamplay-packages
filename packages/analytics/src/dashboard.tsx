"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Bot,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  FlaskConical,
  Globe,
  LayoutDashboard,
  Loader2,
  Mail,
  Network,
  ShieldAlert,
  TableProperties,
  TrendingUp,
  Users,
} from "lucide-react";
import { describeVisitClassificationReason, type VisitClassificationResult } from "./classification.js";
import type {
  AnalyticsDashboardData,
  AnalyticsDashboardRange,
  AnalyticsDashboardTab,
  AnalyticsEmailVisitorData,
  AnalyticsEventRow,
  AnalyticsVisitorHistory,
  AnalyticsVisitorSummary,
} from "./dashboard-types.js";

export type AnalyticsDashboardProps = {
  title?: string;
  accentLabel?: string;
  apiBasePath?: string;
  initialRange?: AnalyticsDashboardRange;
  initialTab?: AnalyticsDashboardTab;
  enabledTabs?: AnalyticsDashboardTab[];
  refreshMs?: number;
};

type MetricType = "visitors" | "pageviews" | "unique_pages" | "avg_per_user";

const ALL_TABS: Array<{ id: AnalyticsDashboardTab; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Traffic Overview", icon: <LayoutDashboard size={16} /> },
  { id: "visitors", label: "Visitors", icon: <Network size={16} /> },
  { id: "emailVisitors", label: "Email Visitors", icon: <Mail size={16} /> },
  { id: "insights", label: "Insights", icon: <TrendingUp size={16} /> },
  { id: "ab", label: "A/B Tests", icon: <FlaskConical size={16} /> },
  { id: "logs", label: "Raw Logs", icon: <TableProperties size={16} /> },
];

const DEFAULT_ENABLED_TABS: AnalyticsDashboardTab[] = [
  "overview",
  "visitors",
  "emailVisitors",
  "insights",
  "ab",
  "logs",
];

export function AnalyticsDashboard({
  title = "Analytics",
  accentLabel = "DreamPlay",
  apiBasePath = "/api/analytics",
  initialRange = "7d",
  initialTab = "overview",
  enabledTabs = DEFAULT_ENABLED_TABS,
  refreshMs = 30_000,
}: AnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [emailData, setEmailData] = useState<AnalyticsVisitorSummary[] | null>(null);
  const [visitorHistory, setVisitorHistory] = useState<AnalyticsVisitorHistory | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<AnalyticsVisitorSummary | null>(null);
  const [range, setRange] = useState<AnalyticsDashboardRange>(initialRange);
  const [filterAdmin, setFilterAdmin] = useState(true);
  const [filterBots, setFilterBots] = useState(true);
  const [activeTab, setActiveTab] = useState<AnalyticsDashboardTab>(initialTab);
  const [activeMetric, setActiveMetric] = useState<MetricType>("pageviews");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabs = useMemo(
    () => ALL_TABS.filter((tab) => enabledTabs.includes(tab.id)),
    [enabledTabs]
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        setError(null);
        const tz = browserTimeZone();
        const json = await fetchJson<AnalyticsDashboardData>(
          `${apiBasePath}/stats?range=${range}&exclude_admin=${filterAdmin}&exclude_bots=${filterBots}&visitor_limit=3000${tz ? `&tz=${encodeURIComponent(tz)}` : ""}&_t=${Date.now()}`
        );
        if (!cancelled) setData(json);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    const interval = window.setInterval(fetchData, refreshMs);
    const onVisibility = () => {
      if (!document.hidden) void fetchData();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [apiBasePath, filterAdmin, filterBots, range, refreshMs]);

  useEffect(() => {
    if (activeTab !== "emailVisitors") return;
    let cancelled = false;
    async function fetchEmailVisitors() {
      setEmailLoading(true);
      try {
        const tz = browserTimeZone();
        const json = await fetchJson<AnalyticsEmailVisitorData>(
          `${apiBasePath}/email-visitors?exclude_admin=${filterAdmin}&exclude_bots=${filterBots}&limit=3000${tz ? `&tz=${encodeURIComponent(tz)}` : ""}&_t=${Date.now()}`
        );
        if (!cancelled) setEmailData(json.emailVisitorStats);
      } catch {
        if (!cancelled) {
          setEmailData(
            data?.visitorStats.filter((visitor) =>
              Boolean(visitor.email || visitor.sid || visitor.cid || visitor.classification?.emailAttributed)
            ) ?? []
          );
        }
      } finally {
        if (!cancelled) setEmailLoading(false);
      }
    }
    fetchEmailVisitors();
    return () => {
      cancelled = true;
    };
  }, [activeTab, apiBasePath, data?.visitorStats, filterAdmin, filterBots]);

  useEffect(() => {
    if (!selectedVisitor) {
      setVisitorHistory(null);
      return;
    }
    const visitor = selectedVisitor;
    let cancelled = false;
    async function fetchHistory() {
      setHistoryLoading(true);
      try {
        const query = visitor.visitorKey
          ? `visitor_key=${encodeURIComponent(visitor.visitorKey)}`
          : `ip=${encodeURIComponent(visitor.ip)}`;
        const tz = browserTimeZone();
        const json = await fetchJson<AnalyticsVisitorHistory>(
          `${apiBasePath}/visitor-history?${query}&range=${range}&exclude_admin=${filterAdmin}&exclude_bots=${filterBots}${tz ? `&tz=${encodeURIComponent(tz)}` : ""}&_t=${Date.now()}`
        );
        if (!cancelled) setVisitorHistory(json);
      } catch {
        if (!cancelled) setVisitorHistory(null);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }
    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [apiBasePath, filterAdmin, filterBots, range, selectedVisitor]);

  const chartTitle = activeMetric === "visitors"
    ? "Unique Visitors Trend"
    : activeMetric === "pageviews"
      ? "Page Views Trend"
      : activeMetric === "unique_pages"
        ? "Unique Pages Trend"
        : "Avg. Pages/User Trend";

  if (loading && !data) {
    return (
      <DashboardFrame>
        <div className="dpa-loading"><Loader2 className="dpa-spin" size={20} /> Loading analytics...</div>
      </DashboardFrame>
    );
  }

  if (!data) {
    return (
      <DashboardFrame>
        <div className="dpa-error">{error ?? "Failed to load analytics."}</div>
      </DashboardFrame>
    );
  }

  return (
    <DashboardFrame>
      <div className="dpa-shell">
        <header className="dpa-header">
          <div>
            <h1 className="dpa-title"><span>{accentLabel}</span> {title}</h1>
            <div className="dpa-live"><span /> {data.liveUsers} Live Users</div>
          </div>

          <div className="dpa-controls">
            <button
              type="button"
              onClick={() => setFilterAdmin((value) => !value)}
              className={`dpa-filter ${filterAdmin ? "is-admin-active" : ""}`}
            >
              <ShieldAlert size={16} />
              {filterAdmin ? "Admin Hidden" : "Show Admin"}
            </button>
            <button
              type="button"
              onClick={() => setFilterBots((value) => !value)}
              className={`dpa-filter ${filterBots ? "is-bot-active" : ""}`}
            >
              <Bot size={16} />
              {filterBots ? "Bots Hidden" : "Show Bots"}
            </button>
            <div className="dpa-range">
              {(["24h", "7d", "30d", "all"] as AnalyticsDashboardRange[]).map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setRange(item)}
                  className={range === item ? "is-active" : ""}
                >
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </header>

        <nav className="dpa-tabs">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={activeTab === tab.id ? "is-active" : ""}
              onClick={() => {
                setSelectedVisitor(null);
                setActiveTab(tab.id);
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {error && <div className="dpa-inline-error">{error}</div>}

        {activeTab === "overview" && (
          <section className="dpa-stack">
            <div className="dpa-kpis">
              <MetricCard
                title="Unique Visitors"
                value={data.uniqueVisitors}
                active={activeMetric === "visitors"}
                icon={<Users />}
                onClick={() => setActiveMetric("visitors")}
              />
              <MetricCard
                title="Total Pageviews"
                value={data.totalPageviews}
                active={activeMetric === "pageviews"}
                icon={<Eye />}
                onClick={() => setActiveMetric("pageviews")}
              />
              <MetricCard
                title="Unique Pages"
                value={data.uniquePages}
                active={activeMetric === "unique_pages"}
                icon={<FileText />}
                onClick={() => setActiveMetric("unique_pages")}
              />
              <MetricCard
                title="Avg. Pages/User"
                value={(data.totalPageviews / (data.uniqueVisitors || 1)).toFixed(1)}
                active={activeMetric === "avg_per_user"}
                icon={<Activity />}
                onClick={() => setActiveMetric("avg_per_user")}
              />
            </div>
            <section className="dpa-panel">
              <div className="dpa-panel-title"><Activity size={18} /> {chartTitle}</div>
              <MiniChart data={data.chartData} metric={activeMetric} />
            </section>
          </section>
        )}

        {activeTab === "visitors" && (
          <VisitorsTab
            selectedVisitor={selectedVisitor}
            setSelectedVisitor={setSelectedVisitor}
            visitors={data.visitorStats}
            history={visitorHistory}
            historyLoading={historyLoading}
            backLabel="Back to Visitors"
          />
        )}

        {activeTab === "emailVisitors" && (
          <VisitorsTab
            selectedVisitor={selectedVisitor}
            setSelectedVisitor={setSelectedVisitor}
            visitors={emailData ?? data.visitorStats.filter((visitor) =>
              Boolean(visitor.email || visitor.sid || visitor.cid || visitor.classification?.emailAttributed)
            )}
            history={visitorHistory}
            historyLoading={historyLoading || emailLoading}
            backLabel="Back to Email Visitors"
            emailMode
          />
        )}

        {activeTab === "logs" && <RawLogsTable events={data.recentEvents} />}

        {activeTab === "ab" && <AbTests results={data.abResults} />}

        {activeTab === "insights" && <InsightsPlaceholder visitors={data.visitorStats} />}

        {activeTab === "chats" && <EmptyState title="Chats are not wired in this package yet." />}
        {activeTab === "exports" && <EmptyState title="Exports are not wired in this package yet." />}
      </div>
    </DashboardFrame>
  );
}

export default AnalyticsDashboard;

function DashboardFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{DASHBOARD_CSS}</style>
      {children}
    </>
  );
}

function MetricCard({
  title,
  value,
  icon,
  active,
  onClick,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`dpa-card ${active ? "is-active" : ""}`} onClick={onClick}>
      <div className="dpa-card-icon">{icon}</div>
      <div>
        <div className="dpa-card-title">{title}</div>
        <div className="dpa-card-value">{value}</div>
      </div>
    </button>
  );
}

function VisitorsTab({
  selectedVisitor,
  setSelectedVisitor,
  visitors,
  history,
  historyLoading,
  backLabel,
  emailMode = false,
}: {
  selectedVisitor: AnalyticsVisitorSummary | null;
  setSelectedVisitor: (visitor: AnalyticsVisitorSummary | null) => void;
  visitors: AnalyticsVisitorSummary[];
  history: AnalyticsVisitorHistory | null;
  historyLoading: boolean;
  backLabel: string;
  emailMode?: boolean;
}) {
  if (selectedVisitor) {
    return (
      <section className="dpa-panel dpa-panel-flush">
        <div className="dpa-detail-header">
          <button type="button" className="dpa-back" onClick={() => setSelectedVisitor(null)}>
            <ArrowLeft size={16} />
            {backLabel}
          </button>
          <span className="dpa-divider" />
          <div className="dpa-detail-id">
            <Network size={16} />
            <span>{selectedVisitor.ip}</span>
            {selectedVisitor.email && <span className="dpa-email-pill">{selectedVisitor.email}</span>}
            <ClassificationBadge result={history?.classification ?? selectedVisitor.classification} />
          </div>
        </div>

        {historyLoading ? (
          <div className="dpa-loading dpa-loading-inner"><Loader2 className="dpa-spin" size={20} /> Loading visitor history...</div>
        ) : history ? (
          <>
            <div className="dpa-detail-grid">
              <DetailCard title="Total Pageviews" value={history.total_pageviews} />
              <DetailCard title="Pages Visited" value={new Set(history.visits.map((visit) => visit.path)).size} />
              <DetailCard title="Total Time on Site" value={formatDuration(history.visits.reduce((sum, visit) => sum + (visit.duration_seconds ?? 0), 0) || null)} highlight />
              <DetailCard title="First Seen" value={formatDate(history.first_seen)} />
              <DetailCard title="Last Seen" value={formatDate(history.last_seen)} />
              <DetailCard
                title="Location"
                value={formatLocation(history.geo?.city, history.geo?.region, history.geo?.country)}
              />
              <DetailCard title="Source" value={selectedVisitor.source ?? "Direct"} />
              <DetailCard title="Journey" value={selectedVisitor.journey_id ?? "-"} />
            </div>
            <VisitHistoryTable visits={history.visits} />
          </>
        ) : (
          <div className="dpa-empty">No visitor history found.</div>
        )}
      </section>
    );
  }

  return (
    <section className="dpa-panel dpa-panel-flush">
      <div className="dpa-table-header">
        <h2><Network size={16} /> {emailMode ? "Email Visitors" : "Recent Visitors"}</h2>
        <span>{visitors.length.toLocaleString()} visitors</span>
      </div>
      <div className="dpa-table-wrap">
        <table className="dpa-table">
          <thead>
            <tr>
              <th>Last Seen</th>
              <th>{emailMode ? "Email / Attribution" : "Visitor"}</th>
              <th>Classification</th>
              <th>Variant</th>
              <th>Source</th>
              <th>Country</th>
              <th>Device</th>
              <th>Page Hits</th>
              <th>Time</th>
              <th>Last Page</th>
            </tr>
          </thead>
          <tbody>
            {visitors.map((visitor) => (
              <tr key={visitor.visitorKey} onClick={() => setSelectedVisitor(visitor)}>
                <td>{formatDate(visitor.lastSeen)}</td>
                <td>
                  <div className="dpa-visitor-cell">
                    <span>{visitor.email ?? visitor.sid ?? visitor.ip}</span>
                    {visitor.email && <small>{visitor.ip}</small>}
                  </div>
                </td>
                <td><ClassificationBadge result={visitor.classification} /></td>
                <td>{visitor.variant ? <span className="dpa-class">{visitor.variant.toUpperCase()}</span> : <span className="dpa-muted">-</span>}</td>
                <td>{visitor.source ? <span className="dpa-source">{visitor.source}</span> : <span className="dpa-muted">-</span>}</td>
                <td><span className="dpa-country"><Globe size={12} /> {visitor.country}</span></td>
                <td><DeviceBadge device={visitor.device} /></td>
                <td><span className="dpa-count">{visitor.count}</span></td>
                <td>{formatDuration(visitor.totalTimeSeconds || null)}</td>
                <td className="dpa-path" title={visitor.lastPath}>{visitor.lastPath}</td>
              </tr>
            ))}
            {visitors.length === 0 && (
              <tr><td colSpan={10} className="dpa-empty-cell">No visitor data available.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DetailCard({ title, value, highlight = false }: { title: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="dpa-detail-card">
      <div>{title}</div>
      <strong className={highlight ? "is-highlight" : ""}>{value}</strong>
    </div>
  );
}

function VisitHistoryTable({ visits }: { visits: AnalyticsVisitorHistory["visits"] }) {
  return (
    <div className="dpa-table-wrap">
      <table className="dpa-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Page</th>
            <th>Visited At</th>
            <th>Time on Page</th>
          </tr>
        </thead>
        <tbody>
          {visits.map((visit, index) => (
            <tr key={`${visit.path}-${visit.visited_at}-${index}`}>
              <td>{index + 1}</td>
              <td className="dpa-page-cell">
                <span title={visit.path}>{visit.path}</span>
                {visit.path.startsWith("http") && (
                  <a href={visit.path} target="_blank" rel="noreferrer"><ExternalLink size={12} /></a>
                )}
              </td>
              <td>{formatDate(visit.visited_at)}</td>
              <td><span className="dpa-duration">{formatDuration(visit.duration_seconds)}</span></td>
            </tr>
          ))}
          {visits.length === 0 && (
            <tr><td colSpan={4} className="dpa-empty-cell">No page visits recorded.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RawLogsTable({ events }: { events: AnalyticsEventRow[] }) {
  return (
    <section className="dpa-panel dpa-panel-flush">
      <div className="dpa-table-header"><h2><TableProperties size={16} /> Raw Logs</h2><span>{events.length} latest</span></div>
      <div className="dpa-table-wrap">
        <table className="dpa-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Path</th>
              <th>IP</th>
              <th>Country</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => (
              <tr key={event.id ?? `${event.created_at}-${index}`}>
                <td>{formatDate(event.created_at)}</td>
                <td><span className="dpa-event">{event.event_name}</span></td>
                <td className="dpa-path" title={event.path}>{event.path}</td>
                <td>{event.ip_address ?? "-"}</td>
                <td>{event.country ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AbTests({ results }: { results: AnalyticsDashboardData["abResults"] }) {
  return (
    <section className="dpa-panel">
      <div className="dpa-panel-title"><FlaskConical size={18} /> A/B Tests</div>
      {results.length === 0 ? (
        <EmptyState title="No A/B test data found for this range." />
      ) : (
        <div className="dpa-ab-grid">
          {results.map((result) => (
            <div className="dpa-ab-card" key={result.variant}>
              <span>{result.label ?? result.variant}</span>
              <strong>{result.conversion_rate}%</strong>
              <small>{result.conversions} conversions from {result.visitors} visitors</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function InsightsPlaceholder({ visitors }: { visitors: AnalyticsVisitorSummary[] }) {
  const scannerCount = visitors.filter((visitor) => visitor.classification?.scannerLikely).length;
  const humanConfirmed = visitors.filter((visitor) => visitor.classification?.humanConfirmed).length;
  const emailAttributed = visitors.filter((visitor) => visitor.classification?.emailAttributed).length;
  return (
    <section className="dpa-stack">
      <div className="dpa-kpis dpa-kpis-three">
        <MetricCard title="Email Attributed" value={emailAttributed} icon={<Mail />} active={false} onClick={() => undefined} />
        <MetricCard title="Scanner Likely" value={scannerCount} icon={<Bot />} active={false} onClick={() => undefined} />
        <MetricCard title="Human Confirmed" value={humanConfirmed} icon={<Users />} active={false} onClick={() => undefined} />
      </div>
      <section className="dpa-panel">
        <div className="dpa-panel-title"><TrendingUp size={18} /> Visit Quality</div>
        <p className="dpa-copy">This packaged version starts with shared scanner and human classification. Deeper journey insights can be layered onto the same UI once each business has checkout and purchase events flowing into its schema.</p>
      </section>
    </section>
  );
}

function EmptyState({ title }: { title: string }) {
  return <section className="dpa-panel"><div className="dpa-empty">{title}</div></section>;
}

function ClassificationBadge({ result }: { result?: VisitClassificationResult }) {
  if (!result) return <span className="dpa-class unknown">Unknown</span>;
  const label = result.classification.replace(/_/g, " ");
  const title = result.reasons.map(describeVisitClassificationReason).join("\n");
  return <span className={`dpa-class ${result.classification}`} title={title}>{label}</span>;
}

function DeviceBadge({ device }: { device: AnalyticsVisitorSummary["device"] }) {
  return <span className={`dpa-device ${device.toLowerCase()}`}>{device}</span>;
}

function MiniChart({ data, metric }: { data: AnalyticsDashboardData["chartData"]; metric: MetricType }) {
  const width = 900;
  const height = 260;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const values = data.map((point) => Number(point[metric]) || 0);
  const max = Math.max(...values, 1);
  const positions = values.map((value, index) => {
    const x = data.length <= 1 ? 0 : (index / (data.length - 1)) * width;
    const y = height - (value / max) * (height - 20) - 10;
    return { x, y };
  });
  const polyPoints = positions.map((p) => `${p.x},${p.y}`).join(" ");
  const area = positions.length > 0
    ? `0,${height} ${polyPoints} ${width},${height}`
    : "";

  function handleMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || data.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xInSvg = ((event.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < positions.length; i++) {
      const d = Math.abs(positions[i].x - xInSvg);
      if (d < nearestDist) {
        nearest = i;
        nearestDist = d;
      }
    }
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const hoveredPos = hoverIndex !== null ? positions[hoverIndex] : null;
  const metricLabel: Record<MetricType, string> = {
    pageviews: "pageviews",
    visitors: "visitors",
    unique_pages: "unique pages",
    avg_per_user: "pages/user",
  };

  return (
    <div className="dpa-chart" style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Analytics trend chart"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="dpaChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#dpaChartFill)" />
        <polyline points={polyPoints} fill="none" stroke="#3b82f6" strokeWidth="3" />
        {hoveredPos && (
          <>
            <line
              x1={hoveredPos.x}
              x2={hoveredPos.x}
              y1={0}
              y2={height}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <circle cx={hoveredPos.x} cy={hoveredPos.y} r={6} fill="#3b82f6" stroke="#fff" strokeWidth={2} />
          </>
        )}
      </svg>
      {hovered && hoveredPos && (
        <div
          className="dpa-chart-tooltip"
          style={{
            position: "absolute",
            left: `${(hoveredPos.x / width) * 100}%`,
            top: `${(hoveredPos.y / height) * (280 / height) * 100}%`,
            transform: "translate(-50%, calc(-100% - 12px))",
            pointerEvents: "none",
          }}
        >
          <div className="dpa-chart-tooltip-title">{hovered.name}</div>
          <div className="dpa-chart-tooltip-row">{hovered.visitors.toLocaleString()} visitors</div>
          <div className="dpa-chart-tooltip-row">{hovered.pageviews.toLocaleString()} pageviews</div>
          <div className="dpa-chart-tooltip-row">{hovered.unique_pages.toLocaleString()} unique pages</div>
          <div className="dpa-chart-tooltip-row dpa-chart-tooltip-active">
            {hovered[metric].toLocaleString()} {metricLabel[metric]}
          </div>
        </div>
      )}
      <div className="dpa-chart-labels">
        {data.map((point) => <span key={point.name}>{point.name}</span>)}
      </div>
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function browserTimeZone(): string | undefined {
  if (typeof Intl === "undefined") return undefined;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "-";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat([], {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function formatLocation(city?: string | null, region?: string | null, country?: string | null): string {
  const parts = [city, region, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Unknown";
}

const DASHBOARD_CSS = `
.dpa-shell{min-height:100vh;background:#171717;color:#fff;padding:24px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
@media (min-width:768px){.dpa-shell{padding:48px}}
.dpa-shell *{box-sizing:border-box}
.dpa-shell>header,.dpa-shell>nav,.dpa-shell>section,.dpa-stack{max-width:1280px;margin-left:auto;margin-right:auto}
.dpa-header{display:flex;gap:24px;justify-content:space-between;align-items:flex-start;margin-bottom:32px;flex-wrap:wrap}
.dpa-title{font-size:32px;line-height:1.1;margin:0;font-weight:800;letter-spacing:-.02em}
.dpa-title span{color:#3b82f6}
.dpa-live{display:inline-flex;align-items:center;gap:8px;margin-top:12px;color:#4ade80;background:rgba(34,197,94,.12);border-radius:999px;padding:6px 12px;font-size:14px}
.dpa-live span{width:8px;height:8px;background:#22c55e;border-radius:999px}
.dpa-controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.dpa-filter{display:inline-flex;align-items:center;gap:8px;border:1px solid #404040;background:#262626;color:#a3a3a3;border-radius:8px;padding:10px 12px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-size:12px;cursor:pointer}
.dpa-filter.is-admin-active{color:#f87171;background:rgba(239,68,68,.14);border-color:rgba(239,68,68,.5)}
.dpa-filter.is-bot-active{color:#fb923c;background:rgba(249,115,22,.14);border-color:rgba(249,115,22,.5)}
.dpa-range{display:flex;background:#262626;border:1px solid #404040;border-radius:10px;padding:4px}
.dpa-range button{border:0;background:transparent;color:#a3a3a3;border-radius:7px;padding:8px 16px;font-weight:700;cursor:pointer}
.dpa-range button.is-active{background:#2563eb;color:#fff}
.dpa-tabs{display:flex;border-bottom:1px solid #262626;overflow-x:auto;margin-bottom:32px}
.dpa-tabs button{display:flex;align-items:center;gap:10px;border:0;background:transparent;color:#a3a3a3;padding:18px 24px;font-size:15px;font-weight:700;white-space:nowrap;border-bottom:2px solid transparent;cursor:pointer}
.dpa-tabs button.is-active{color:#60a5fa;background:rgba(255,255,255,.03);border-bottom-color:#3b82f6}
.dpa-stack{display:grid;gap:24px}
.dpa-kpis{display:grid;grid-template-columns:repeat(1,minmax(0,1fr));gap:16px}
@media (min-width:768px){.dpa-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}.dpa-kpis-three{grid-template-columns:repeat(3,minmax(0,1fr))}}
.dpa-card{display:flex;align-items:center;text-align:left;gap:16px;background:#262626;border:1px solid #404040;border-radius:14px;padding:20px;color:#fff;cursor:pointer;transition:.15s ease}
.dpa-card:hover,.dpa-card.is-active{border-color:#3b82f6;background:rgba(59,130,246,.08)}
.dpa-card-icon{color:#60a5fa}
.dpa-card-title{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#737373;margin-bottom:6px}
.dpa-card-value{font-size:28px;font-weight:800}
.dpa-panel{background:#262626;border:1px solid #404040;border-radius:14px;padding:24px;max-width:1280px;margin-left:auto;margin-right:auto}
.dpa-panel-flush{padding:0;overflow:hidden}
.dpa-panel-title{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:800;margin-bottom:18px;color:#e5e5e5}
.dpa-chart{height:330px}
.dpa-chart svg{width:100%;height:280px;display:block;background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0));border-radius:10px;cursor:crosshair}
.dpa-chart-labels{display:flex;justify-content:space-between;color:#737373;font-size:12px;margin-top:8px;overflow:hidden}
.dpa-chart-tooltip{background:rgba(15,15,15,.96);border:1px solid #404040;border-radius:8px;padding:10px 12px;color:#e5e5e5;font-size:12px;line-height:1.5;min-width:140px;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:10;white-space:nowrap}
.dpa-chart-tooltip-title{font-weight:700;color:#fff;font-size:13px;margin-bottom:4px;letter-spacing:.02em}
.dpa-chart-tooltip-row{color:#a3a3a3}
.dpa-chart-tooltip-active{color:#60a5fa;font-weight:600;margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,.08)}
.dpa-table-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #404040;background:rgba(38,38,38,.85)}
.dpa-table-header h2{display:flex;align-items:center;gap:10px;font-size:16px;margin:0;color:#e5e5e5}
.dpa-table-header span{font-size:12px;color:#737373}
.dpa-table-wrap{overflow-x:auto}
.dpa-table{width:100%;border-collapse:collapse;font-size:14px;color:#a3a3a3}
.dpa-table th{background:rgba(23,23,23,.55);color:#d4d4d4;text-transform:uppercase;letter-spacing:.06em;font-size:12px;text-align:left;padding:14px 18px;white-space:nowrap}
.dpa-table td{padding:14px 18px;border-top:1px solid rgba(64,64,64,.6);vertical-align:middle}
.dpa-table tbody tr{cursor:pointer}
.dpa-table tbody tr:hover{background:rgba(255,255,255,.04)}
.dpa-visitor-cell{display:flex;flex-direction:column;gap:3px;min-width:160px;color:#fff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.dpa-visitor-cell small{color:#737373;font-family:inherit}
.dpa-path{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d4d4d4}
.dpa-page-cell{display:flex;gap:8px;align-items:center;max-width:620px;color:#e5e5e5}
.dpa-page-cell span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dpa-page-cell a{color:#737373}
.dpa-source{display:inline-block;max-width:220px;overflow:hidden;text-overflow:ellipsis;color:#c084fc;background:rgba(168,85,247,.12);border:1px solid rgba(168,85,247,.25);border-radius:7px;padding:3px 7px;font-size:12px}
.dpa-country{display:inline-flex;gap:6px;align-items:center}
.dpa-count,.dpa-duration,.dpa-event{display:inline-block;background:#404040;color:#fff;border-radius:6px;padding:3px 8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.dpa-duration{background:rgba(59,130,246,.12);color:#60a5fa}
.dpa-class{display:inline-block;border-radius:7px;padding:4px 8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;background:#404040;color:#d4d4d4}
.dpa-class.scanner_likely{background:rgba(249,115,22,.14);color:#fb923c;border:1px solid rgba(249,115,22,.3)}
.dpa-class.bot_likely{background:rgba(239,68,68,.14);color:#f87171;border:1px solid rgba(239,68,68,.3)}
.dpa-class.human_likely{background:rgba(59,130,246,.14);color:#60a5fa;border:1px solid rgba(59,130,246,.3)}
.dpa-class.human_confirmed{background:rgba(34,197,94,.14);color:#4ade80;border:1px solid rgba(34,197,94,.3)}
.dpa-device{display:inline-block;border-radius:7px;padding:4px 8px;font-size:11px;font-weight:800;text-transform:uppercase;background:#404040;color:#a3a3a3}
.dpa-device.desktop{background:rgba(34,197,94,.12);color:#4ade80}.dpa-device.mobile{background:rgba(59,130,246,.12);color:#60a5fa}.dpa-device.tablet{background:rgba(168,85,247,.12);color:#c084fc}.dpa-device.bot{background:rgba(249,115,22,.12);color:#fb923c}
.dpa-detail-header{display:flex;align-items:center;gap:16px;padding:16px 20px;border-bottom:1px solid #404040;flex-wrap:wrap}
.dpa-back{display:inline-flex;align-items:center;gap:8px;border:0;background:transparent;color:#a3a3a3;cursor:pointer;font-weight:700}
.dpa-back:hover{color:#fff}
.dpa-divider{height:22px;width:1px;background:#404040}
.dpa-detail-id{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-weight:800;color:#e5e5e5}
.dpa-email-pill{color:#4ade80;background:rgba(34,197,94,.12);border-radius:7px;padding:4px 8px;font-size:13px}
.dpa-detail-grid{display:grid;grid-template-columns:repeat(1,minmax(0,1fr));gap:12px;padding:20px;background:rgba(255,255,255,.02)}
@media (min-width:768px){.dpa-detail-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.dpa-detail-card{background:rgba(23,23,23,.7);border-radius:10px;padding:14px}
.dpa-detail-card div{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#737373;margin-bottom:8px}
.dpa-detail-card strong{font-size:18px;color:#fff}
.dpa-detail-card strong.is-highlight{color:#34d399}
.dpa-empty,.dpa-loading,.dpa-error{min-height:320px;display:flex;align-items:center;justify-content:center;color:#a3a3a3;gap:10px}
.dpa-loading-inner{min-height:220px}
.dpa-error,.dpa-inline-error{color:#f87171}
.dpa-inline-error{max-width:1280px;margin:0 auto 16px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);padding:12px 14px;border-radius:10px}
.dpa-empty-cell{text-align:center!important;color:#737373!important;padding:36px!important}
.dpa-ab-grid{display:grid;grid-template-columns:repeat(1,minmax(0,1fr));gap:16px}@media (min-width:768px){.dpa-ab-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.dpa-ab-card{background:rgba(23,23,23,.65);border:1px solid #404040;border-radius:12px;padding:18px;display:grid;gap:8px}
.dpa-ab-card span{color:#d4d4d4}.dpa-ab-card strong{font-size:32px}.dpa-ab-card small{color:#737373}
.dpa-copy{color:#a3a3a3;line-height:1.7;margin:0}
.dpa-muted{color:#737373}
.dpa-spin{animation:dpa-spin 1s linear infinite}@keyframes dpa-spin{to{transform:rotate(360deg)}}
`;
