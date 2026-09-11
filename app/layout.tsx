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

const antdTheme = {
  token: {
    colorPrimary: "#6366f1",
    colorLink: "#6366f1",
    colorLinkHover: "#818cf8",
    colorLinkActive: "#4f46e5",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBgLayout: "#faf8f5",
    colorBorder: "#e8e4de",
    colorBorderSecondary: "#f0ece6",
    colorText: "#2d2a26",
    colorTextSecondary: "#6b6560",
    colorTextTertiary: "#9e9890",
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    fontFamily:
      'var(--font-geist-sans), "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
  },
  components: {
    Button: {
      colorPrimary: "#6366f1",
      colorPrimaryHover: "#818cf8",
      colorPrimaryActive: "#4f46e5",
      borderRadius: 12,
    },
    Input: {
      borderRadius: 12,
      colorBorder: "#e8e4de",
      activeBorderColor: "#6366f1",
      hoverBorderColor: "#c7d2fe",
    },
    Select: {
      borderRadius: 12,
      colorBorder: "#e8e4de",
    },
    Modal: {
      borderRadiusLG: 16,
    },
    Card: {
      borderRadius: 16,
    },
    Tag: {
      borderRadiusSM: 999,
    },
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
          <ConfigProvider theme={antdTheme} modal={{ centered: true }}>
            <AntdApp>{children}</AntdApp>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
