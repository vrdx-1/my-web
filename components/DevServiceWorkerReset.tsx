"use client";

import { useEffect } from "react";

const DEV_SW_RESET_KEY = "__jutpai_dev_sw_reset_done__";

export function DevServiceWorkerReset() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (window.sessionStorage.getItem(DEV_SW_RESET_KEY) === "1") return;

    void (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const hadRegistrations = registrations.length > 0;
        await Promise.all(registrations.map((r) => r.unregister()));

        let hadCaches = false;
        if ("caches" in window) {
          const cacheNames = await window.caches.keys();
          hadCaches = cacheNames.length > 0;
          await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
        }

        window.sessionStorage.setItem(DEV_SW_RESET_KEY, "1");

        // Avoid auto-reload to keep first page entry stable.
        // Cleanup still happens best-effort and takes effect on next manual refresh/navigation.
        void hadRegistrations;
        void hadCaches;
      } catch {
        // Best-effort cleanup only.
      }
    })();
  }, []);

  return null;
}
