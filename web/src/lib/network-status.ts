export const NETWORK_REACHABILITY_CHANGED_EVENT = "network-reachability-changed";

export type NetworkReachabilityChangedDetail = {
  reachable: boolean;
  source: "api-success" | "api-failure" | "probe" | "navigator-offline";
};

const OFFLINE_PROBE_INTERVAL_MS = 3000;
const HTML_PROBE_QUERY_KEY = "__network_probe__";

let reachable = navigator.onLine;
let monitorStarted = false;
let probeTimerId: number | null = null;
let probing = false;

const emitReachabilityChanged = (
  detail: NetworkReachabilityChangedDetail
) => {
  window.dispatchEvent(
    new CustomEvent<NetworkReachabilityChangedDetail>(
      NETWORK_REACHABILITY_CHANGED_EVENT,
      { detail }
    )
  );
};

const setReachable = (
  next: boolean,
  source: NetworkReachabilityChangedDetail["source"]
) => {
  if (reachable === next) {
    return;
  }
  reachable = next;
  emitReachabilityChanged({ reachable: next, source });
};

const clearProbeTimer = () => {
  if (probeTimerId !== null) {
    window.clearTimeout(probeTimerId);
    probeTimerId = null;
  }
};

const scheduleProbe = () => {
  clearProbeTimer();
  if (reachable) {
    return;
  }
  const intervalMs = OFFLINE_PROBE_INTERVAL_MS;
  probeTimerId = window.setTimeout(() => {
    void runReachabilityProbe();
  }, intervalMs);
};

const fetchReachable = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<boolean> => {
  try {
    const response = await fetch(input, {
      cache: "no-store",
      credentials: "same-origin",
      ...init,
    });
    return response.ok;
  } catch {
    return false;
  }
};

const buildHtmlProbeUrl = (): string => {
  const url = new URL("/index.html", window.location.origin);
  // Workbox precache の既定設定ではこのクエリは無視されないため、
  // キャッシュ応答ではなくネットワーク到達性を判定できる。
  url.searchParams.set(HTML_PROBE_QUERY_KEY, String(Date.now()));
  return `${url.pathname}${url.search}`;
};

const runReachabilityProbe = async () => {
  if (probing) {
    if (!reachable) {
      scheduleProbe();
    }
    return;
  }
  probing = true;
  try {
    if (!navigator.onLine) {
      setReachable(false, "navigator-offline");
      return;
    }

    const [apiOk, htmlOkRaw] = await Promise.all([
      fetchReachable("/healthz", { method: "GET" }),
      fetchReachable(buildHtmlProbeUrl(), {
        method: "GET",
        headers: { Accept: "text/html" },
      }),
    ]);
    // Service Worker 制御下の HTML はキャッシュ偽陽性があり得るため、
    // 到達性判定には API を優先し、HTML は SW 非制御時のみ採用する。
    const htmlOk = !navigator.serviceWorker?.controller && htmlOkRaw;
    setReachable(apiOk || htmlOk, "probe");
  } finally {
    probing = false;
    if (!reachable) {
      scheduleProbe();
    }
  }
};

export const reportNetworkSuccess = () => {
  setReachable(true, "api-success");
  clearProbeTimer();
};

export const reportNetworkFailure = () => {
  setReachable(false, "api-failure");
  clearProbeTimer();
  void runReachabilityProbe();
};

export const isNetworkReachable = () => reachable;

export const startNetworkReachabilityMonitor = () => {
  if (monitorStarted) {
    return;
  }
  monitorStarted = true;

  const handleOnline = () => {
    if (!reachable) {
      clearProbeTimer();
      void runReachabilityProbe();
    }
  };
  const handleOffline = () => {
    setReachable(false, "navigator-offline");
    clearProbeTimer();
    void runReachabilityProbe();
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible" && !reachable) {
      clearProbeTimer();
      void runReachabilityProbe();
    }
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  if (!reachable) {
    clearProbeTimer();
    void runReachabilityProbe();
  }
};
