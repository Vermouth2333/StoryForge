"use client";

import { useSearchParams } from "next/navigation";

export function useWorkPageMode(
  authorId: string | undefined,
  currentUserId: string | null,
) {
  const searchParams = useSearchParams();
  const fromMarket = searchParams.get("from") === "market";
  const isAuthor = !!currentUserId && !!authorId && currentUserId === authorId;
  const canEdit = isAuthor && !fromMarket;
  return { fromMarket, isAuthor, canEdit };
}
