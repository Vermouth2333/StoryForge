export const CREDIT_COSTS = {
  chat: 2,
  image: 8,
  video: 30,
} as const;

export const SIGNUP_CREDITS = 100;

export const CREDIT_PACKAGES = [
  { id: "starter", name: "体验包", credits: 60, priceLabel: "¥6", blurb: "试水对话与少量配图" },
  { id: "creator", name: "创作包", credits: 300, priceLabel: "¥28", blurb: "日常续写与配图" },
  { id: "studio", name: "畅玩包", credits: 1280, priceLabel: "¥98", blurb: "含多次配视频" },
] as const;

export type CreditSpendReason = "chat" | "image" | "video";
export type CreditGrantReason = "grant" | "signup" | "refund_image" | "refund_video" | "refund_chat";
