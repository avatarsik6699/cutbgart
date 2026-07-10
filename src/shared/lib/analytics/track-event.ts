import type { AnalyticsEvent, AnalyticsEventData } from "./types";

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: AnalyticsEventData) => void;
    };
  }
}

/**
 * No-op when the Umami tracker script hasn't loaded (dev/test, or the script
 * gated out per `shared/config/env`) — safe to call unconditionally from any
 * call site (SPEC.md §7.6).
 */
export function trackEvent(event: AnalyticsEvent, data?: AnalyticsEventData): void {
  if (typeof window === "undefined") return;
  window.umami?.track(event, data);
}
