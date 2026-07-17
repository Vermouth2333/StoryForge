import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "sharp", "pdf-parse", "mammoth", "word-extractor"],
};

export default nextConfig;
