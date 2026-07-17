import type { Metadata } from "next";
import { App as AntdApp } from "antd";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "./globals.css";

export const metadata: Metadata = {
  title: "StoryForge",
  description: "StoryForge interactive novel creation platform",
  icons: {
    icon: [{ url: "/brand/logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/logo.svg" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AntdRegistry>
          <AntdApp>{children}</AntdApp>
        </AntdRegistry>
      </body>
    </html>
  );
}
