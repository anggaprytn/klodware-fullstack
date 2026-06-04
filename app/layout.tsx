import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Klodware Ship Maintenance",
  description: "Web admin and REST API foundation for Klodware Ship Maintenance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
