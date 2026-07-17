import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdfkit", "sharp", "pdf-parse", "mammoth", "word-extractor"],
};

export default nextConfig;
