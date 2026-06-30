import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "合同智能分析平台 Demo",
  description: "多格式合同智能分析平台",
  icons: {
    icon: "/feidu-logo.png",
    shortcut: "/feidu-logo.png",
    apple: "/feidu-logo.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
