import {
  ATTRIBUTION_KEYS,
  type AnalyticsEventName,
  type AttributionMetadata,
  type Business,
  type BusinessAnalyticsEvent,
  type JsonObject,
} from "./schema.js";

export type BusinessAnalyticsConfig = {
  business: Business;
  endpoint: string;
  brand?: string;
  offer?: string;
  sourceRepo?: string;
  trackerVersion?: string;
  storagePrefix?: string;
  defaultMetadata?: JsonObject;
  includeHostInPath?: boolean;
};

export type TrackOptions = {
  path?: string;
  useBeacon?: boolean;
};

export type PageLeaveOptions = TrackOptions & {
  startedAt?: number;
  durationSeconds?: number;
  metadata?: JsonObject;
};

export type LifecycleOptions = {
  trackPageview?: boolean;
  minDurationSeconds?: number;
  pageviewMetadata?: JsonObject;
  pageLeaveMetadata?: JsonObject;
};

export type TrackResult = {
  ok: boolean;
  status?: number;
  error?: unknown;
  usedBeacon?: boolean;
};

export type BusinessAnalyticsClient = {
  captureAttribution: () => AttributionMetadata;
  getAttribution: () => AttributionMetadata;
  getSessionId: () => string;
  getAnonymousId: () => string;
  buildEvent: (
    eventName: AnalyticsEventName,
    metadata?: JsonObject,
    options?: TrackOptions
  ) => BusinessAnalyticsEvent;
  track: (
    eventName: AnalyticsEventName,
    metadata?: JsonObject,
    options?: TrackOptions
  ) => Promise<TrackResult>;
  trackPageview: (metadata?: JsonObject, options?: TrackOptions) => Promise<TrackResult>;
  trackPageLeave: (options?: PageLeaveOptions) => Promise<TrackResult>;
  installPageLifecycleTracking: (options?: LifecycleOptions) => () => void;
};

const DEFAULT_TRACKER_VERSION = "0.1.0";
const DEFAULT_STORAGE_PREFIX = "dreamplay_analytics";

function browserWindow(): Window | undefined {
  return typeof window === "undefined" ? undefined : window;
}

function browserDocument(): Document | undefined {
  return typeof document === "undefined" ? undefined : document;
}

function browserNavigator(): Navigator | undefined {
  return typeof navigator === "undefined" ? undefined : navigator;
}

function safeRandomId(prefix: string): string {
  const cryptoObj = browserWindow()?.crypto ?? globalThis.crypto;
  if (cryptoObj?.randomUUID) return `${prefix}_${cryptoObj.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function readJson<T>(storage: Storage | undefined, key: string, fallback: T): T {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(storage: Storage | undefined, key: string, value: unknown): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures. Tracking should never affect page UX.
  }
}

function readString(storage: Storage | undefined, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(storage: Storage | undefined, key: string, value: string): void {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
}

function sessionStorageSafe(): Storage | undefined {
  try {
    return browserWindow()?.sessionStorage;
  } catch {
    return undefined;
  }
}

function localStorageSafe(): Storage | undefined {
  try {
    return browserWindow()?.localStorage;
  } catch {
    return undefined;
  }
}

function readAttributionFromUrl(): AttributionMetadata {
  const win = browserWindow();
  if (!win) return {};
  const params = new URLSearchParams(win.location.search);
  const out: AttributionMetadata = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = params.get(key);
    if (value) out[key] = value.slice(0, 500);
  }
  return out;
}

function hasKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function endpointFromConfig(endpoint: string): string {
  return endpoint.trim();
}

function currentHost(): string {
  return browserWindow()?.location.host || "unknown";
}

function currentPath(includeHost: boolean): string {
  const win = browserWindow();
  if (!win) return "unknown";
  const path = `${win.location.pathname}${win.location.search}`;
  return includeHost ? `${win.location.host}${path}` : path;
}

function currentReferrer(): string | null {
  return browserDocument()?.referrer || null;
}

export function createBusinessAnalytics(config: BusinessAnalyticsConfig): BusinessAnalyticsClient {
  const endpoint = endpointFromConfig(config.endpoint);
  const trackerVersion = config.trackerVersion ?? DEFAULT_TRACKER_VERSION;
  const storagePrefix = config.storagePrefix ?? DEFAULT_STORAGE_PREFIX;
  const includeHostInPath = config.includeHostInPath ?? true;
  const attributionKey = `${storagePrefix}:attribution`;
  const sessionIdKey = `${storagePrefix}:session_id`;
  const anonymousIdKey = `${storagePrefix}:anonymous_id`;

  if (!endpoint) {
    throw new Error("createBusinessAnalytics requires a non-empty endpoint");
  }

  function getSessionId(): string {
    const storage = sessionStorageSafe();
    const existing = readString(storage, sessionIdKey);
    if (existing) return existing;
    const fresh = safeRandomId("s");
    writeString(storage, sessionIdKey, fresh);
    return fresh;
  }

  function getAnonymousId(): string {
    const local = localStorageSafe();
    const existing = readString(local, anonymousIdKey);
    if (existing) return existing;
    const fresh = safeRandomId("a");
    writeString(local, anonymousIdKey, fresh);
    return fresh;
  }

  function getAttribution(): AttributionMetadata {
    return readJson<AttributionMetadata>(sessionStorageSafe(), attributionKey, {});
  }

  function captureAttribution(): AttributionMetadata {
    const fromUrl = readAttributionFromUrl();
    const existing = getAttribution();
    const merged = hasKeys(fromUrl) ? { ...existing, ...fromUrl } : existing;
    if (hasKeys(fromUrl)) writeJson(sessionStorageSafe(), attributionKey, merged);
    return merged;
  }

  function buildEvent(
    eventName: AnalyticsEventName,
    metadata: JsonObject = {},
    options: TrackOptions = {}
  ): BusinessAnalyticsEvent {
    const attribution = captureAttribution();
    const eventPath = options.path ?? currentPath(includeHostInPath);
    const eventMetadata = {
      ...(config.defaultMetadata ?? {}),
      business: config.business,
      ...(config.brand ? { brand: config.brand } : {}),
      ...(config.offer ? { offer: config.offer } : {}),
      host: currentHost(),
      referrer: currentReferrer(),
      ...(config.sourceRepo ? { source_repo: config.sourceRepo } : {}),
      ...attribution,
      ...metadata,
    };

    const sessionId = getSessionId();
    const event: BusinessAnalyticsEvent = {
      event_name: eventName,
      eventName,
      path: eventPath,
      session_id: sessionId,
      sessionId,
      anonymous_id: getAnonymousId(),
      tracker_version: trackerVersion,
      metadata: eventMetadata,
    };

    return event;
  }

  async function sendEvent(event: BusinessAnalyticsEvent, useBeacon = false): Promise<TrackResult> {
    const body = JSON.stringify(event);
    if (useBeacon) {
      const nav = browserNavigator();
      if (typeof nav?.sendBeacon === "function") {
        try {
          const sent = nav.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
          if (sent) return { ok: true, usedBeacon: true };
        } catch {
          // Fall back to fetch below.
        }
      }
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: useBeacon,
      });
      return { ok: response.ok, status: response.status, usedBeacon: false };
    } catch (error) {
      return { ok: false, error, usedBeacon: false };
    }
  }

  function track(
    eventName: AnalyticsEventName,
    metadata: JsonObject = {},
    options: TrackOptions = {}
  ): Promise<TrackResult> {
    const event = buildEvent(eventName, metadata, options);
    return sendEvent(event, options.useBeacon ?? false);
  }

  function trackPageview(metadata: JsonObject = {}, options: TrackOptions = {}): Promise<TrackResult> {
    return track("pageview", metadata, options);
  }

  function trackPageLeave(options: PageLeaveOptions = {}): Promise<TrackResult> {
    const now = Date.now();
    const durationSeconds =
      options.durationSeconds ??
      (options.startedAt ? Math.round((now - options.startedAt) / 1000) : undefined);
    return track(
      "page_leave",
      {
        ...(options.metadata ?? {}),
        ...(durationSeconds !== undefined ? { duration_seconds: durationSeconds } : {}),
      },
      { path: options.path, useBeacon: options.useBeacon ?? true }
    );
  }

  function installPageLifecycleTracking(options: LifecycleOptions = {}): () => void {
    const doc = browserDocument();
    const win = browserWindow();
    if (!doc || !win) return () => {};

    let startedAt = Date.now();
    let leaveSent = false;
    const minDurationSeconds = options.minDurationSeconds ?? 1;

    if (options.trackPageview) {
      void trackPageview(options.pageviewMetadata);
    }

    const sendLeave = () => {
      if (leaveSent) return;
      const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
      if (durationSeconds < minDurationSeconds) return;
      leaveSent = true;
      void trackPageLeave({
        startedAt,
        durationSeconds,
        metadata: options.pageLeaveMetadata,
        useBeacon: true,
      });
    };

    const handleVisibilityChange = () => {
      if (doc.visibilityState === "hidden") {
        sendLeave();
      } else if (doc.visibilityState === "visible") {
        startedAt = Date.now();
        leaveSent = false;
      }
    };

    win.addEventListener("pagehide", sendLeave);
    doc.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      win.removeEventListener("pagehide", sendLeave);
      doc.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }

  return {
    captureAttribution,
    getAttribution,
    getSessionId,
    getAnonymousId,
    buildEvent,
    track,
    trackPageview,
    trackPageLeave,
    installPageLifecycleTracking,
  };
}
