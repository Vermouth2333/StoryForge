import { CacheService } from "@/lib/cache";

/** 故事/角色/世界发布、下架或已发布内容更新后，清除市场 Feed 缓存 */
export async function invalidateMarketCache() {
  await CacheService.delPattern("feed:*");
  await CacheService.del("works:hot");
}
