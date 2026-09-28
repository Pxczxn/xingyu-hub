import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "星语社区",
  description: "Xingyu Hub community shell",
  icons: {
    icon: [{ url: "/brand/logo-icon-32.png?v=2", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/brand/logo-icon-180.png?v=2", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      {/* AppShell is applied per-page for community routes; auth/editor pages omit it */}
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  );
}
