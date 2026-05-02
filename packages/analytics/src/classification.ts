import { asFiniteNumber, asString, isRecord, type AnalyticsEventName } from "./schema.js";

export type VisitClassification =
  | "human_confirmed"
  | "human_likely"
  | "scanner_likely"
  | "bot_likely"
  | "unknown";

export type VisitClassificationReason =
  | "email_attribution_present"
  | "known_bot_user_agent"
  | "known_security_scanner_user_agent"
  | "literal_ampersand_query"
  | "multiple_email_links_same_second"
  | "cross_domain_email_links"
  | "rapid_pageview_burst"
  | "mostly_zero_duration_pages"
  | "only_passive_events"
  | "checkout_or_purchase_event"
  | "lead_or_form_event"
  | "human_interaction_event"
  | "meaningful_time_on_page"
  | "realistic_multi_page_timing";

export type VisitClassificationEvent = {
  event_name?: AnalyticsEventName | string | null;
  eventName?: AnalyticsEventName | string | null;
  path?: string | null;
  created_at?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  timestamp?: string | number | Date | null;
  session_id?: string | null;
  sessionId?: string | null;
  anonymous_id?: string | null;
  anonymousId?: string | null;
  user_agent?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type NormalizedVisitEvent = {
  eventName: string;
  path: string;
  createdAtMs?: number;
  host?: string;
  sid?: string;
  cid?: string;
  durationSeconds?: number;
  userAgent?: string;
  metadata: Record<string, unknown>;
};

export type VisitClassificationOptions = {
  burstWindowMs?: number;
  crossDomainWindowMs?: number;
  meaningfulDurationSeconds?: number;
  totalMeaningfulDurationSeconds?: number;
  zeroDurationSeconds?: number;
  humanEventNames?: string[];
  confirmedHumanEventNames?: string[];
};

export type VisitClassificationStats = {
  eventCount: number;
  pageviewCount: number;
  emailAttributedEventCount: number;
  uniquePathCount: number;
  uniqueHostCount: number;
  totalDurationSeconds: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
};

export type VisitClassificationResult = {
  classification: VisitClassification;
  emailAttributed: boolean;
  scannerLikely: boolean;
  botLikely: boolean;
  humanLikely: boolean;
  humanConfirmed: boolean;
  confidence: number;
  scannerScore: number;
  humanScore: number;
  reasons: VisitClassificationReason[];
  stats: VisitClassificationStats;
};

const DEFAULT_OPTIONS = {
  burstWindowMs: 2_000,
  crossDomainWindowMs: 10_000,
  meaningfulDurationSeconds: 10,
  totalMeaningfulDurationSeconds: 30,
  zeroDurationSeconds: 1,
} as const;

const PASSIVE_EVENT_NAMES = new Set(["", "pageview", "page_leave"]);

const DEFAULT_HUMAN_EVENT_NAMES = [
  "add_to_cart",
  "begin_checkout",
  "checkout_start",
  "click",
  "cta_click",
  "form_submit",
  "interaction",
  "lead",
  "purchase",
  "scroll_depth",
  "signup",
  "subscribe",
  "user_interaction",
  "video_play",
];

const DEFAULT_CONFIRMED_HUMAN_EVENT_NAMES = [
  "add_to_cart",
  "begin_checkout",
  "checkout_start",
  "click",
  "cta_click",
  "form_submit",
  "interaction",
  "lead",
  "purchase",
  "signup",
  "subscribe",
  "user_interaction",
];

const BOT_USER_AGENT_PATTERN =
  /bot|spider|crawl|headless|lighthouse|pingdom|curl|wget|python-requests|axios|node-fetch|go-http-client|java\/|php|ruby|selenium|playwright|puppeteer/i;

const SECURITY_SCANNER_USER_AGENT_PATTERN =
  /proofpoint|mimecast|barracuda|trustwave|urlscan|phishtank|phish|security|sandbox|safelinks|safe-links|defender|office365|microsoft exchange|symantec|forcepoint|checkpoint|trend micro|zscaler|cloudmark|area 1|ironscales|inky|perception point/i;

export const VISIT_CLASSIFICATION_REASON_LABELS = {
  email_attribution_present: "URL/session contains email attribution",
  known_bot_user_agent: "User agent looks like automation",
  known_security_scanner_user_agent: "User agent looks like a security scanner",
  literal_ampersand_query: "URL contains literal &amp; query separators",
  multiple_email_links_same_second: "Multiple email links landed in the same second",
  cross_domain_email_links: "Email-attributed links landed across multiple domains",
  rapid_pageview_burst: "Several pageviews landed in a very short burst",
  mostly_zero_duration_pages: "Most page durations are zero or near-zero",
  only_passive_events: "Only passive pageview/page-leave events were seen",
  checkout_or_purchase_event: "Checkout or purchase event was seen",
  lead_or_form_event: "Lead or form event was seen",
  human_interaction_event: "Human interaction event was seen",
  meaningful_time_on_page: "Visit spent meaningful time on page",
  realistic_multi_page_timing: "Multiple pages were visited with human-like timing",
} as const satisfies Record<VisitClassificationReason, string>;

export function describeVisitClassificationReason(reason: VisitClassificationReason): string {
  return VISIT_CLASSIFICATION_REASON_LABELS[reason];
}

export function normalizeVisitEvents(events: VisitClassificationEvent[]): NormalizedVisitEvent[] {
  return events.map((event) => {
    const metadata = isRecord(event.metadata) ? event.metadata : {};
    const path = asString(event.path) ?? asString(metadata.path) ?? "";
    const queryAttribution = readAttributionFromPath(path);
    const eventName = asString(event.event_name) ?? asString(event.eventName) ?? "";
    const userAgent =
      asString(event.user_agent) ??
      asString(event.userAgent) ??
      asString(metadata.user_agent) ??
      asString(metadata.userAgent);
    const durationSeconds =
      asFiniteNumber(metadata.duration_seconds) ??
      asFiniteNumber(metadata.durationSeconds) ??
      asFiniteNumber((event as Record<string, unknown>).duration_seconds) ??
      asFiniteNumber((event as Record<string, unknown>).durationSeconds);

    return {
      eventName,
      path,
      createdAtMs: timestampMs(event.created_at ?? event.createdAt ?? event.timestamp),
      host: asString(metadata.host) ?? hostFromPath(path),
      sid: asString(metadata.sid) ?? queryAttribution.sid,
      cid: asString(metadata.cid) ?? queryAttribution.cid,
      durationSeconds,
      userAgent,
      metadata,
    };
  });
}

export function classifyVisit(
  events: VisitClassificationEvent[],
  options: VisitClassificationOptions = {}
): VisitClassificationResult {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const normalized = normalizeVisitEvents(events).sort((a, b) => {
    if (a.createdAtMs === undefined && b.createdAtMs === undefined) return 0;
    if (a.createdAtMs === undefined) return 1;
    if (b.createdAtMs === undefined) return -1;
    return a.createdAtMs - b.createdAtMs;
  });

  const reasons = new Set<VisitClassificationReason>();
  let scannerScore = 0;
  let humanScore = 0;

  const humanEventNames = new Set([
    ...DEFAULT_HUMAN_EVENT_NAMES,
    ...(options.humanEventNames ?? []),
  ]);
  const confirmedHumanEventNames = new Set([
    ...DEFAULT_CONFIRMED_HUMAN_EVENT_NAMES,
    ...(options.confirmedHumanEventNames ?? []),
  ]);

  const pageviews = normalized.filter((event) => event.eventName === "pageview");
  const emailAttributedEvents = normalized.filter(hasEmailAttribution);
  const durationEvents = normalized.filter((event) => event.durationSeconds !== undefined);
  const hosts = uniqueDefined(normalized.map((event) => event.host));
  const paths = uniqueDefined(normalized.map((event) => event.path).filter(Boolean));
  const totalDurationSeconds = durationEvents.reduce(
    (total, event) => total + (event.durationSeconds ?? 0),
    0
  );

  if (emailAttributedEvents.length > 0) reasons.add("email_attribution_present");

  const userAgents = uniqueDefined(normalized.map((event) => event.userAgent));
  if (userAgents.some((userAgent) => SECURITY_SCANNER_USER_AGENT_PATTERN.test(userAgent))) {
    reasons.add("known_security_scanner_user_agent");
    scannerScore += 4;
  } else if (userAgents.some((userAgent) => BOT_USER_AGENT_PATTERN.test(userAgent))) {
    reasons.add("known_bot_user_agent");
    scannerScore += 3;
  }

  if (normalized.some((event) => hasLiteralAmpersandQuery(event.path))) {
    reasons.add("literal_ampersand_query");
    scannerScore += 2;
  }

  if (hasMultipleEmailLinksSameSecond(pageviews)) {
    reasons.add("multiple_email_links_same_second");
    scannerScore += 3;
  }

  if (hasCrossDomainEmailBurst(emailAttributedEvents, mergedOptions.crossDomainWindowMs)) {
    reasons.add("cross_domain_email_links");
    scannerScore += 3;
  }

  if (maxEventsInWindow(pageviews, mergedOptions.burstWindowMs) >= 3) {
    reasons.add("rapid_pageview_burst");
    scannerScore += 2;
  }

  const zeroDurationCount = durationEvents.filter(
    (event) => (event.durationSeconds ?? 0) <= mergedOptions.zeroDurationSeconds
  ).length;
  if (durationEvents.length >= 2 && zeroDurationCount / durationEvents.length >= 0.75) {
    reasons.add("mostly_zero_duration_pages");
    scannerScore += 1;
  }

  const onlyPassiveEvents = normalized.every((event) =>
    PASSIVE_EVENT_NAMES.has(event.eventName)
  );
  if (onlyPassiveEvents && normalized.length > 0) {
    reasons.add("only_passive_events");
    if (scannerScore > 0) scannerScore += 1;
  }

  const eventNames = normalized.map((event) => event.eventName);
  const hasCheckoutOrPurchase = eventNames.some((eventName) =>
    ["begin_checkout", "checkout_start", "purchase"].includes(eventName)
  );
  if (hasCheckoutOrPurchase) {
    reasons.add("checkout_or_purchase_event");
    humanScore += 5;
  }

  const hasLeadOrForm = eventNames.some((eventName) =>
    ["form_submit", "lead", "signup", "subscribe"].includes(eventName)
  );
  if (hasLeadOrForm) {
    reasons.add("lead_or_form_event");
    humanScore += 5;
  }

  const hasHumanInteraction = eventNames.some((eventName) =>
    humanEventNames.has(eventName)
  );
  if (hasHumanInteraction) {
    reasons.add("human_interaction_event");
    humanScore += 3;
  }

  if (
    durationEvents.some(
      (event) => (event.durationSeconds ?? 0) >= mergedOptions.meaningfulDurationSeconds
    ) ||
    totalDurationSeconds >= mergedOptions.totalMeaningfulDurationSeconds
  ) {
    reasons.add("meaningful_time_on_page");
    humanScore += 2;
  }

  if (
    pageviews.length >= 2 &&
    paths.length >= 2 &&
    timespanMs(pageviews) >= mergedOptions.crossDomainWindowMs
  ) {
    reasons.add("realistic_multi_page_timing");
    humanScore += 2;
  }

  const hasConfirmedHumanEvent = eventNames.some((eventName) =>
    confirmedHumanEventNames.has(eventName)
  );
  const humanConfirmed = hasConfirmedHumanEvent || hasCheckoutOrPurchase || hasLeadOrForm;
  const humanLikely = humanConfirmed || humanScore >= 2;
  const botLikely = reasons.has("known_bot_user_agent") && !humanConfirmed;
  const scannerLikely =
    scannerScore >= 3 || (scannerScore >= 2 && humanScore === 0);

  const classification = chooseClassification({
    botLikely,
    scannerLikely,
    humanConfirmed,
    humanLikely,
  });

  return {
    classification,
    emailAttributed: emailAttributedEvents.length > 0,
    scannerLikely,
    botLikely,
    humanLikely,
    humanConfirmed,
    confidence: confidenceForClassification(classification, scannerScore, humanScore),
    scannerScore,
    humanScore,
    reasons: Array.from(reasons),
    stats: {
      eventCount: normalized.length,
      pageviewCount: pageviews.length,
      emailAttributedEventCount: emailAttributedEvents.length,
      uniquePathCount: paths.length,
      uniqueHostCount: hosts.length,
      totalDurationSeconds,
      firstSeenAt: isoFromMs(firstTimestampMs(normalized)),
      lastSeenAt: isoFromMs(lastTimestampMs(normalized)),
    },
  };
}

function chooseClassification(input: {
  botLikely: boolean;
  scannerLikely: boolean;
  humanConfirmed: boolean;
  humanLikely: boolean;
}): VisitClassification {
  if (input.humanConfirmed) return "human_confirmed";
  if (input.botLikely) return "bot_likely";
  if (input.scannerLikely) return "scanner_likely";
  if (input.humanLikely) return "human_likely";
  return "unknown";
}

function confidenceForClassification(
  classification: VisitClassification,
  scannerScore: number,
  humanScore: number
): number {
  if (classification === "human_confirmed") return 0.9;
  if (classification === "scanner_likely") return Math.min(0.95, 0.55 + scannerScore * 0.1);
  if (classification === "bot_likely") return Math.min(0.95, 0.55 + scannerScore * 0.1);
  if (classification === "human_likely") return Math.min(0.85, 0.5 + humanScore * 0.08);
  return 0.35;
}

function hasEmailAttribution(event: NormalizedVisitEvent): boolean {
  return Boolean(event.sid || event.cid);
}

function hasLiteralAmpersandQuery(path: string): boolean {
  return /(?:&amp;|%26amp%3b|%26amp;)/i.test(path);
}

function readAttributionFromPath(path: string): { sid?: string; cid?: string } {
  const queryStart = path.indexOf("?");
  if (queryStart === -1) return {};
  const hashStart = path.indexOf("#", queryStart);
  const rawQuery =
    hashStart === -1 ? path.slice(queryStart + 1) : path.slice(queryStart + 1, hashStart);
  const normalizedQuery = rawQuery
    .replace(/&amp;/gi, "&")
    .replace(/%26amp%3b/gi, "&")
    .replace(/%26amp;/gi, "&");
  const params = new URLSearchParams(normalizedQuery);
  return {
    sid: asString(params.get("sid")),
    cid: asString(params.get("cid")),
  };
}

function hostFromPath(path: string): string | undefined {
  if (!path) return undefined;
  try {
    if (/^https?:\/\//i.test(path)) return new URL(path).host;
  } catch {
    return undefined;
  }
  if (path.startsWith("/")) return undefined;
  const firstSegment = path.split(/[/?#]/)[0];
  return firstSegment?.includes(".") ? firstSegment : undefined;
}

function timestampMs(value: string | number | Date | null | undefined): number | undefined {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isoFromMs(value: number | undefined): string | undefined {
  return value === undefined ? undefined : new Date(value).toISOString();
}

function firstTimestampMs(events: NormalizedVisitEvent[]): number | undefined {
  return events.find((event) => event.createdAtMs !== undefined)?.createdAtMs;
}

function lastTimestampMs(events: NormalizedVisitEvent[]): number | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const value = events[index]?.createdAtMs;
    if (value !== undefined) return value;
  }
  return undefined;
}

function timespanMs(events: NormalizedVisitEvent[]): number {
  const first = firstTimestampMs(events);
  const last = lastTimestampMs(events);
  if (first === undefined || last === undefined) return 0;
  return Math.max(0, last - first);
}

function uniqueDefined(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function hasMultipleEmailLinksSameSecond(events: NormalizedVisitEvent[]): boolean {
  const buckets = new Map<number, Set<string>>();
  for (const event of events) {
    if (!hasEmailAttribution(event) || event.createdAtMs === undefined) continue;
    const bucket = Math.floor(event.createdAtMs / 1_000);
    const paths = buckets.get(bucket) ?? new Set<string>();
    paths.add(event.path);
    buckets.set(bucket, paths);
  }
  return Array.from(buckets.values()).some((paths) => paths.size >= 2);
}

function hasCrossDomainEmailBurst(
  events: NormalizedVisitEvent[],
  windowMs: number
): boolean {
  const timedEvents = events.filter(
    (event) => event.createdAtMs !== undefined && event.host !== undefined
  );
  for (let start = 0; start < timedEvents.length; start += 1) {
    const startTime = timedEvents[start]?.createdAtMs;
    if (startTime === undefined) continue;
    const hosts = new Set<string>();
    for (let end = start; end < timedEvents.length; end += 1) {
      const event = timedEvents[end];
      if (event?.createdAtMs === undefined || event.host === undefined) continue;
      if (event.createdAtMs - startTime > windowMs) break;
      hosts.add(event.host);
      if (hosts.size >= 2) return true;
    }
  }
  return false;
}

function maxEventsInWindow(events: NormalizedVisitEvent[], windowMs: number): number {
  const timedEvents = events.filter((event) => event.createdAtMs !== undefined);
  let max = 0;
  for (let start = 0; start < timedEvents.length; start += 1) {
    const startTime = timedEvents[start]?.createdAtMs;
    if (startTime === undefined) continue;
    let count = 0;
    for (let end = start; end < timedEvents.length; end += 1) {
      const event = timedEvents[end];
      if (event?.createdAtMs === undefined) continue;
      if (event.createdAtMs - startTime > windowMs) break;
      count += 1;
    }
    max = Math.max(max, count);
  }
  return max;
}
