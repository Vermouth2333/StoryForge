import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "pdfkit",
    "sharp",
    "pdf-parse",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "mammoth",
    "word-extractor",
    "ffmpeg-static",
  ],
  outputFileTracingIncludes: {
    "/api/works/import-parse": [
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
    ],
  },
};

export default nextConfig;
