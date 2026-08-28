import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdfkit", "sharp", "pdf-parse", "mammoth", "word-extractor", "ffmpeg-static"],
};

export default nextConfig;
