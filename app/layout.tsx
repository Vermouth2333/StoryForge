import type { Metadata } from "next";
import { App as AntdApp } from "antd";
import "./globals.css";

export const metadata: Metadata = {
  title: "StoryForge MVP",
  description: "StoryForge interactive novel creation platform MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AntdApp>{children}</AntdApp>
      </body>
    </html>
  );
}
