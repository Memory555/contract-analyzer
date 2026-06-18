import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "合同智能分析平台 Demo",
  description: "DOCX 合同智能分析 Demo",
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
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
