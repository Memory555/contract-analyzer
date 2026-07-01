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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (!window.crypto) window.crypto = {};
                if (typeof window.crypto.randomUUID !== 'function') {
                  window.crypto.randomUUID = function() {
                    if (window.crypto.getRandomValues) {
                      return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, function(c) {
                        return (c ^ window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
                      });
                    }
                    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, function(c) {
                      return (c ^ Math.random() * 16 & 3 | 8).toString(16);
                    });
                  };
                }
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
