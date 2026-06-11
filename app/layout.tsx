import type { Metadata } from "next";
import Script from "next/script";
import { ToastProvider } from "./admin/components/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Klodware Ship Maintenance",
  description:
    "Web admin and REST API foundation for Klodware Ship Maintenance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
        <Script
          src="https://stator.apps.anggaprytn.com/widget.js"
          strategy="afterInteractive"
          data-agent-id="12774c6a-6ad9-4a49-9de0-9765a9866406"
          data-public-key="pk_stator_Qi87XyXm0BOexaeVu_GpGH6R0JsIpoDf2rNbfVRPNoA"
          data-api-base-url="https://stator-api.apps.anggaprytn.com"
          data-title="Klodware Assistant"
          data-primary-color="#0f766e"
          data-placeholder="Ask about Klodware"
          data-welcome-message="Ask Klodware for help with inspections, vessels, PDF reports, sync issues, users, or the mobile app workflow."
          data-starter-prompts="Web Admin::What can I do in the Klodware web admin console?|Mobile App::How does an inspector complete an inspection in the Klodware mobile app?|PDF Report::Why is my inspection PDF not ready yet?|Sync Issue::Why did my mobile inspection fail to sync?"
          data-persistence="local"
          data-persistence-ttl-days="7"
          data-position="bottom-right"
          data-theme="light"
        />
      </body>
    </html>
  );
}
