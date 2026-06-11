"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";

type AssistantTheme = "dark" | "light";

function getAssistantTheme(pathname: string, fallbackTheme: AssistantTheme) {
  if (pathname === "/admin/login") {
    return "dark";
  }

  if (pathname.startsWith("/admin")) {
    return "light";
  }

  return fallbackTheme;
}

function syncStatorTheme(theme: AssistantTheme) {
  document
    .querySelectorAll<HTMLScriptElement>('script[src*="stator.apps.anggaprytn.com/widget.js"]')
    .forEach((script) => {
      script.dataset.theme = theme;
    });

  document.querySelectorAll<HTMLElement>(".stator-widget-host").forEach((host) => {
    const widgetRoot = host.shadowRoot?.querySelector<HTMLElement>(
      ".stator-widget-root",
    );

    if (widgetRoot) {
      widgetRoot.dataset.theme = theme;
    }
  });
}

export function AssistantThemeSync({
  initialTheme,
}: {
  initialTheme: AssistantTheme;
}) {
  const pathname = usePathname();
  const theme = useMemo(
    () => getAssistantTheme(pathname, initialTheme),
    [initialTheme, pathname],
  );

  useEffect(() => {
    syncStatorTheme(theme);

    const observer = new MutationObserver(() => {
      syncStatorTheme(theme);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [theme]);

  return null;
}
