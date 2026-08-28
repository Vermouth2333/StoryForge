import type { Metadata } from "next";
import { App as AntdApp, ConfigProvider } from "antd";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "./globals.css";

export const metadata: Metadata = {
  title: "StoryForge",
  description: "AI 角色互动平台：戴人设面具走进故事，平台提供对话、插画与配视频。",
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
          <ConfigProvider modal={{ centered: true }}>
            <AntdApp>{children}</AntdApp>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
