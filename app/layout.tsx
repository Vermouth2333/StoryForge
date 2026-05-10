import type { Metadata } from "next";
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
