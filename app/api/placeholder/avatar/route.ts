import { NextResponse } from "next/server";

/** 返回默认头像 SVG，用于评论等场景的头像占位 */
export async function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="40" fill="#DCE9FF"/>
  <circle cx="40" cy="30" r="12" fill="#5B9DFF"/>
  <ellipse cx="40" cy="62" rx="20" ry="14" fill="#5B9DFF"/>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
