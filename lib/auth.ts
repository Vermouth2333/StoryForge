import { cookies, headers } from "next/headers";

export async function getCurrentUserId() {
  const h = await headers();
  const c = await cookies();
  return (
    h.get("x-user-id") ??
    c.get("sf_user_id")?.value ??
    "demo_user_google_123456"
  );
}
