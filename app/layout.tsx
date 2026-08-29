import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * 字体:Shantell Sans(手写标题)+ Quicksand(正文)—— 自托管 woff2,
 * 见 globals.css 顶部 @font-face(kit §2.2;不依赖 Google Fonts CDN)。
 * CJK 无手写字形,中文标题回落 PingFang SC 700(kit §2.2 规则)。
 */
export const metadata: Metadata = {
  title: "理理理 — a quiet place for your day",
  description: "Speak your day. Keep the story. Let the room talk it through.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FFF9EE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
