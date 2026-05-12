"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, Bot, Clock, ExternalLink, Eye, FileText, FlaskConical, Globe, LayoutDashboard, Loader2, Mail, Network, ShieldAlert, TableProperties, TrendingUp, Users, } from "lucide-react";
import { describeVisitClassificationReason } from "./classification.js";
const ALL_TABS = [
    { id: "overview", label: "Traffic Overview", icon: _jsx(LayoutDashboard, { size: 16 }) },
    { id: "visitors", label: "Visitors", icon: _jsx(Network, { size: 16 }) },
    { id: "emailVisitors", label: "Email Visitors", icon: _jsx(Mail, { size: 16 }) },
    { id: "insights", label: "Insights", icon: _jsx(TrendingUp, { size: 16 }) },
    { id: "ab", label: "A/B Tests", icon: _jsx(FlaskConical, { size: 16 }) },
    { id: "logs", label: "Raw Logs", icon: _jsx(TableProperties, { size: 16 }) },
];
const DEFAULT_ENABLED_TABS = [
    "overview",
    "visitors",
    "emailVisitors",
    "insights",
    "ab",
    "logs",
];
export function AnalyticsDashboard({ title = "Analytics", accentLabel = "DreamPlay", apiBasePath = "/api/analytics", initialRange = "7d", initialTab = "overview", enabledTabs = DEFAULT_ENABLED_TABS, refreshMs = 30_000, }) {
    const [data, setData] = useState(null);
    const [emailData, setEmailData] = useState(null);
    const [visitorHistory, setVisitorHistory] = useState(null);
    const [selectedVisitor, setSelectedVisitor] = useState(null);
    const [range, setRange] = useState(initialRange);
    const [filterAdmin, setFilterAdmin] = useState(true);
    const [filterBots, setFilterBots] = useState(true);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [activeMetric, setActiveMetric] = useState("pageviews");
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);
    const [error, setError] = useState(null);
    const tabs = useMemo(() => ALL_TABS.filter((tab) => enabledTabs.includes(tab.id)), [enabledTabs]);
    useEffect(() => {
        let cancelled = false;
        async function fetchData() {
            if (typeof document !== "undefined" && document.hidden)
                return;
            try {
                setError(null);
                const tz = browserTimeZone();
                const json = await fetchJson(`${apiBasePath}/stats?range=${range}&exclude_admin=${filterAdmin}&exclude_bots=${filterBots}&visitor_limit=3000${tz ? `&tz=${encodeURIComponent(tz)}` : ""}&_t=${Date.now()}`);
                if (!cancelled)
                    setData(json);
            }
            catch (caught) {
                if (!cancelled)
                    setError(caught instanceof Error ? caught.message : "Failed to load analytics");
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        }
        fetchData();
        const interval = window.setInterval(fetchData, refreshMs);
        const onVisibility = () => {
            if (!document.hidden)
                void fetchData();
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [apiBasePath, filterAdmin, filterBots, range, refreshMs]);
    useEffect(() => {
        if (activeTab !== "emailVisitors")
            return;
        let cancelled = false;
        async function fetchEmailVisitors() {
            setEmailLoading(true);
            try {
                const tz = browserTimeZone();
                const json = await fetchJson(`${apiBasePath}/email-visitors?exclude_admin=${filterAdmin}&exclude_bots=${filterBots}&limit=3000${tz ? `&tz=${encodeURIComponent(tz)}` : ""}&_t=${Date.now()}`);
                if (!cancelled)
                    setEmailData(json.emailVisitorStats);
            }
            catch {
                if (!cancelled) {
                    setEmailData(data?.visitorStats.filter((visitor) => Boolean(visitor.email || visitor.sid || visitor.cid || visitor.classification?.emailAttributed)) ?? []);
                }
            }
            finally {
                if (!cancelled)
                    setEmailLoading(false);
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
                const json = await fetchJson(`${apiBasePath}/visitor-history?${query}&range=${range}&exclude_admin=${filterAdmin}&exclude_bots=${filterBots}${tz ? `&tz=${encodeURIComponent(tz)}` : ""}&_t=${Date.now()}`);
                if (!cancelled)
                    setVisitorHistory(json);
            }
            catch {
                if (!cancelled)
                    setVisitorHistory(null);
            }
            finally {
                if (!cancelled)
                    setHistoryLoading(false);
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
        return (_jsx(DashboardFrame, { children: _jsxs("div", { className: "dpa-loading", children: [_jsx(Loader2, { className: "dpa-spin", size: 20 }), " Loading analytics..."] }) }));
    }
    if (!data) {
        return (_jsx(DashboardFrame, { children: _jsx("div", { className: "dpa-error", children: error ?? "Failed to load analytics." }) }));
    }
    return (_jsx(DashboardFrame, { children: _jsxs("div", { className: "dpa-shell", children: [_jsxs("header", { className: "dpa-header", children: [_jsxs("div", { children: [_jsxs("h1", { className: "dpa-title", children: [_jsx("span", { children: accentLabel }), " ", title] }), _jsxs("div", { className: "dpa-live", children: [_jsx("span", {}), " ", data.liveUsers, " Live Users"] })] }), _jsxs("div", { className: "dpa-controls", children: [_jsxs("button", { type: "button", onClick: () => setFilterAdmin((value) => !value), className: `dpa-filter ${filterAdmin ? "is-admin-active" : ""}`, children: [_jsx(ShieldAlert, { size: 16 }), filterAdmin ? "Admin Hidden" : "Show Admin"] }), _jsxs("button", { type: "button", onClick: () => setFilterBots((value) => !value), className: `dpa-filter ${filterBots ? "is-bot-active" : ""}`, children: [_jsx(Bot, { size: 16 }), filterBots ? "Bots Hidden" : "Show Bots"] }), _jsx("div", { className: "dpa-range", children: ["24h", "7d", "30d", "all"].map((item) => (_jsx("button", { type: "button", onClick: () => setRange(item), className: range === item ? "is-active" : "", children: item.toUpperCase() }, item))) })] })] }), _jsx("nav", { className: "dpa-tabs", children: tabs.map((tab) => (_jsxs("button", { type: "button", className: activeTab === tab.id ? "is-active" : "", onClick: () => {
                            setSelectedVisitor(null);
                            setActiveTab(tab.id);
                        }, children: [tab.icon, tab.label] }, tab.id))) }), error && _jsx("div", { className: "dpa-inline-error", children: error }), activeTab === "overview" && (_jsxs("section", { className: "dpa-stack", children: [_jsxs("div", { className: "dpa-kpis", children: [_jsx(MetricCard, { title: "Unique Visitors", value: data.uniqueVisitors, active: activeMetric === "visitors", icon: _jsx(Users, {}), onClick: () => setActiveMetric("visitors") }), _jsx(MetricCard, { title: "Total Pageviews", value: data.totalPageviews, active: activeMetric === "pageviews", icon: _jsx(Eye, {}), onClick: () => setActiveMetric("pageviews") }), _jsx(MetricCard, { title: "Unique Pages", value: data.uniquePages, active: activeMetric === "unique_pages", icon: _jsx(FileText, {}), onClick: () => setActiveMetric("unique_pages") }), _jsx(MetricCard, { title: "Avg. Pages/User", value: (data.totalPageviews / (data.uniqueVisitors || 1)).toFixed(1), active: activeMetric === "avg_per_user", icon: _jsx(Activity, {}), onClick: () => setActiveMetric("avg_per_user") })] }), _jsxs("section", { className: "dpa-panel", children: [_jsxs("div", { className: "dpa-panel-title", children: [_jsx(Activity, { size: 18 }), " ", chartTitle] }), _jsx(MiniChart, { data: data.chartData, metric: activeMetric })] })] })), activeTab === "visitors" && (_jsx(VisitorsTab, { selectedVisitor: selectedVisitor, setSelectedVisitor: setSelectedVisitor, visitors: data.visitorStats, history: visitorHistory, historyLoading: historyLoading, backLabel: "Back to Visitors" })), activeTab === "emailVisitors" && (_jsx(VisitorsTab, { selectedVisitor: selectedVisitor, setSelectedVisitor: setSelectedVisitor, visitors: emailData ?? data.visitorStats.filter((visitor) => Boolean(visitor.email || visitor.sid || visitor.cid || visitor.classification?.emailAttributed)), history: visitorHistory, historyLoading: historyLoading || emailLoading, backLabel: "Back to Email Visitors", emailMode: true })), activeTab === "logs" && _jsx(RawLogsTable, { events: data.recentEvents }), activeTab === "ab" && _jsx(AbTests, { results: data.abResults }), activeTab === "insights" && _jsx(InsightsPlaceholder, { visitors: data.visitorStats }), activeTab === "chats" && _jsx(EmptyState, { title: "Chats are not wired in this package yet." }), activeTab === "exports" && _jsx(EmptyState, { title: "Exports are not wired in this package yet." })] }) }));
}
export default AnalyticsDashboard;
function DashboardFrame({ children }) {
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: DASHBOARD_CSS }), children] }));
}
function MetricCard({ title, value, icon, active, onClick, }) {
    return (_jsxs("button", { type: "button", className: `dpa-card ${active ? "is-active" : ""}`, onClick: onClick, children: [_jsx("div", { className: "dpa-card-icon", children: icon }), _jsxs("div", { children: [_jsx("div", { className: "dpa-card-title", children: title }), _jsx("div", { className: "dpa-card-value", children: value })] })] }));
}
function VisitorsTab({ selectedVisitor, setSelectedVisitor, visitors, history, historyLoading, backLabel, emailMode = false, }) {
    if (selectedVisitor) {
        return (_jsxs("section", { className: "dpa-panel dpa-panel-flush", children: [_jsxs("div", { className: "dpa-detail-header", children: [_jsxs("button", { type: "button", className: "dpa-back", onClick: () => setSelectedVisitor(null), children: [_jsx(ArrowLeft, { size: 16 }), backLabel] }), _jsx("span", { className: "dpa-divider" }), _jsxs("div", { className: "dpa-detail-id", children: [_jsx(Network, { size: 16 }), _jsx("span", { children: selectedVisitor.ip }), selectedVisitor.email && _jsx("span", { className: "dpa-email-pill", children: selectedVisitor.email }), _jsx(ClassificationBadge, { result: history?.classification ?? selectedVisitor.classification })] })] }), historyLoading ? (_jsxs("div", { className: "dpa-loading dpa-loading-inner", children: [_jsx(Loader2, { className: "dpa-spin", size: 20 }), " Loading visitor history..."] })) : history ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "dpa-detail-grid", children: [_jsx(DetailCard, { title: "Total Pageviews", value: history.total_pageviews }), _jsx(DetailCard, { title: "Pages Visited", value: new Set(history.visits.map((visit) => visit.path)).size }), _jsx(DetailCard, { title: "Total Time on Site", value: formatDuration(history.visits.reduce((sum, visit) => sum + (visit.duration_seconds ?? 0), 0) || null), highlight: true }), _jsx(DetailCard, { title: "First Seen", value: formatDate(history.first_seen) }), _jsx(DetailCard, { title: "Last Seen", value: formatDate(history.last_seen) }), _jsx(DetailCard, { title: "Location", value: formatLocation(history.geo?.city, history.geo?.region, history.geo?.country) }), _jsx(DetailCard, { title: "Source", value: selectedVisitor.source ?? "Direct" }), _jsx(DetailCard, { title: "Journey", value: selectedVisitor.journey_id ?? "-" })] }), _jsx(VisitHistoryTable, { visits: history.visits })] })) : (_jsx("div", { className: "dpa-empty", children: "No visitor history found." }))] }));
    }
    return (_jsxs("section", { className: "dpa-panel dpa-panel-flush", children: [_jsxs("div", { className: "dpa-table-header", children: [_jsxs("h2", { children: [_jsx(Network, { size: 16 }), " ", emailMode ? "Email Visitors" : "Recent Visitors"] }), _jsxs("span", { children: [visitors.length.toLocaleString(), " visitors"] })] }), _jsx("div", { className: "dpa-table-wrap", children: _jsxs("table", { className: "dpa-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Last Seen" }), _jsx("th", { children: emailMode ? "Email / Attribution" : "Visitor" }), _jsx("th", { children: "Classification" }), _jsx("th", { children: "Source" }), _jsx("th", { children: "Country" }), _jsx("th", { children: "Device" }), _jsx("th", { children: "Page Hits" }), _jsx("th", { children: "Time" }), _jsx("th", { children: "Last Page" })] }) }), _jsxs("tbody", { children: [visitors.map((visitor) => (_jsxs("tr", { onClick: () => setSelectedVisitor(visitor), children: [_jsx("td", { children: formatDate(visitor.lastSeen) }), _jsx("td", { children: _jsxs("div", { className: "dpa-visitor-cell", children: [_jsx("span", { children: visitor.email ?? visitor.sid ?? visitor.ip }), visitor.email && _jsx("small", { children: visitor.ip })] }) }), _jsx("td", { children: _jsx(ClassificationBadge, { result: visitor.classification }) }), _jsx("td", { children: visitor.source ? _jsx("span", { className: "dpa-source", children: visitor.source }) : _jsx("span", { className: "dpa-muted", children: "-" }) }), _jsx("td", { children: _jsxs("span", { className: "dpa-country", children: [_jsx(Globe, { size: 12 }), " ", visitor.country] }) }), _jsx("td", { children: _jsx(DeviceBadge, { device: visitor.device }) }), _jsx("td", { children: _jsx("span", { className: "dpa-count", children: visitor.count }) }), _jsx("td", { children: formatDuration(visitor.totalTimeSeconds || null) }), _jsx("td", { className: "dpa-path", title: visitor.lastPath, children: visitor.lastPath })] }, visitor.visitorKey))), visitors.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 9, className: "dpa-empty-cell", children: "No visitor data available." }) }))] })] }) })] }));
}
function DetailCard({ title, value, highlight = false }) {
    return (_jsxs("div", { className: "dpa-detail-card", children: [_jsx("div", { children: title }), _jsx("strong", { className: highlight ? "is-highlight" : "", children: value })] }));
}
function VisitHistoryTable({ visits }) {
    return (_jsx("div", { className: "dpa-table-wrap", children: _jsxs("table", { className: "dpa-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "#" }), _jsx("th", { children: "Page" }), _jsx("th", { children: "Visited At" }), _jsx("th", { children: "Time on Page" })] }) }), _jsxs("tbody", { children: [visits.map((visit, index) => (_jsxs("tr", { children: [_jsx("td", { children: index + 1 }), _jsxs("td", { className: "dpa-page-cell", children: [_jsx("span", { title: visit.path, children: visit.path }), visit.path.startsWith("http") && (_jsx("a", { href: visit.path, target: "_blank", rel: "noreferrer", children: _jsx(ExternalLink, { size: 12 }) }))] }), _jsx("td", { children: formatDate(visit.visited_at) }), _jsx("td", { children: _jsx("span", { className: "dpa-duration", children: formatDuration(visit.duration_seconds) }) })] }, `${visit.path}-${visit.visited_at}-${index}`))), visits.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "dpa-empty-cell", children: "No page visits recorded." }) }))] })] }) }));
}
function RawLogsTable({ events }) {
    return (_jsxs("section", { className: "dpa-panel dpa-panel-flush", children: [_jsxs("div", { className: "dpa-table-header", children: [_jsxs("h2", { children: [_jsx(TableProperties, { size: 16 }), " Raw Logs"] }), _jsxs("span", { children: [events.length, " latest"] })] }), _jsx("div", { className: "dpa-table-wrap", children: _jsxs("table", { className: "dpa-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Time" }), _jsx("th", { children: "Event" }), _jsx("th", { children: "Path" }), _jsx("th", { children: "IP" }), _jsx("th", { children: "Country" })] }) }), _jsx("tbody", { children: events.map((event, index) => (_jsxs("tr", { children: [_jsx("td", { children: formatDate(event.created_at) }), _jsx("td", { children: _jsx("span", { className: "dpa-event", children: event.event_name }) }), _jsx("td", { className: "dpa-path", title: event.path, children: event.path }), _jsx("td", { children: event.ip_address ?? "-" }), _jsx("td", { children: event.country ?? "-" })] }, event.id ?? `${event.created_at}-${index}`))) })] }) })] }));
}
function AbTests({ results }) {
    return (_jsxs("section", { className: "dpa-panel", children: [_jsxs("div", { className: "dpa-panel-title", children: [_jsx(FlaskConical, { size: 18 }), " A/B Tests"] }), results.length === 0 ? (_jsx(EmptyState, { title: "No A/B test data found for this range." })) : (_jsx("div", { className: "dpa-ab-grid", children: results.map((result) => (_jsxs("div", { className: "dpa-ab-card", children: [_jsx("span", { children: result.label ?? result.variant }), _jsxs("strong", { children: [result.conversion_rate, "%"] }), _jsxs("small", { children: [result.conversions, " conversions from ", result.visitors, " visitors"] })] }, result.variant))) }))] }));
}
function InsightsPlaceholder({ visitors }) {
    const scannerCount = visitors.filter((visitor) => visitor.classification?.scannerLikely).length;
    const humanConfirmed = visitors.filter((visitor) => visitor.classification?.humanConfirmed).length;
    const emailAttributed = visitors.filter((visitor) => visitor.classification?.emailAttributed).length;
    return (_jsxs("section", { className: "dpa-stack", children: [_jsxs("div", { className: "dpa-kpis dpa-kpis-three", children: [_jsx(MetricCard, { title: "Email Attributed", value: emailAttributed, icon: _jsx(Mail, {}), active: false, onClick: () => undefined }), _jsx(MetricCard, { title: "Scanner Likely", value: scannerCount, icon: _jsx(Bot, {}), active: false, onClick: () => undefined }), _jsx(MetricCard, { title: "Human Confirmed", value: humanConfirmed, icon: _jsx(Users, {}), active: false, onClick: () => undefined })] }), _jsxs("section", { className: "dpa-panel", children: [_jsxs("div", { className: "dpa-panel-title", children: [_jsx(TrendingUp, { size: 18 }), " Visit Quality"] }), _jsx("p", { className: "dpa-copy", children: "This packaged version starts with shared scanner and human classification. Deeper journey insights can be layered onto the same UI once each business has checkout and purchase events flowing into its schema." })] })] }));
}
function EmptyState({ title }) {
    return _jsx("section", { className: "dpa-panel", children: _jsx("div", { className: "dpa-empty", children: title }) });
}
function ClassificationBadge({ result }) {
    if (!result)
        return _jsx("span", { className: "dpa-class unknown", children: "Unknown" });
    const label = result.classification.replace(/_/g, " ");
    const title = result.reasons.map(describeVisitClassificationReason).join("\n");
    return _jsx("span", { className: `dpa-class ${result.classification}`, title: title, children: label });
}
function DeviceBadge({ device }) {
    return _jsx("span", { className: `dpa-device ${device.toLowerCase()}`, children: device });
}
function MiniChart({ data, metric }) {
    const width = 900;
    const height = 260;
    const values = data.map((point) => Number(point[metric]) || 0);
    const max = Math.max(...values, 1);
    const points = values.map((value, index) => {
        const x = data.length <= 1 ? 0 : (index / (data.length - 1)) * width;
        const y = height - (value / max) * (height - 20) - 10;
        return `${x},${y}`;
    });
    const area = points.length > 0
        ? `0,${height} ${points.join(" ")} ${width},${height}`
        : "";
    return (_jsxs("div", { className: "dpa-chart", children: [_jsxs("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Analytics trend chart", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "dpaChartFill", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#3b82f6", stopOpacity: "0.35" }), _jsx("stop", { offset: "100%", stopColor: "#3b82f6", stopOpacity: "0" })] }) }), _jsx("polygon", { points: area, fill: "url(#dpaChartFill)" }), _jsx("polyline", { points: points.join(" "), fill: "none", stroke: "#3b82f6", strokeWidth: "3" })] }), _jsx("div", { className: "dpa-chart-labels", children: data.map((point) => _jsx("span", { children: point.name }, point.name)) })] }));
}
async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok)
        throw new Error(`Request failed: ${response.status}`);
    return response.json();
}
function browserTimeZone() {
    if (typeof Intl === "undefined")
        return undefined;
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    }
    catch {
        return undefined;
    }
}
function formatDuration(seconds) {
    if (seconds === null)
        return "-";
    if (seconds < 60)
        return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60)
        return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
}
function formatDate(value) {
    if (!value)
        return "-";
    return new Date(value).toLocaleString();
}
function formatLocation(city, region, country) {
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
.dpa-chart svg{width:100%;height:280px;display:block;background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0));border-radius:10px}
.dpa-chart-labels{display:flex;justify-content:space-between;color:#737373;font-size:12px;margin-top:8px;overflow:hidden}
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
//# sourceMappingURL=dashboard.js.map