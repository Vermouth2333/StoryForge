import { getRedisClient } from './redis-client';

interface CacheOptions {
  ttlSeconds?: number;
}

export class CacheService {
  private static defaultTTL = 300; // 5 minutes

  static async get<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (!client) {
      return null;
    }

    try {
      const value = await client.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (err) {
      console.error('Cache get error:', err);
      return null;
    }
  }

  static async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const client = getRedisClient();
    if (!client) {
      return;
    }

    try {
      const ttl = options.ttlSeconds ?? this.defaultTTL;
      await client.setex(key, ttl, JSON.stringify(value));
    } catch (err) {
      console.error('Cache set error:', err);
    }
  }

  static async del(key: string): Promise<void> {
    const client = getRedisClient();
    if (!client) {
      return;
    }

    try {
      await client.del(key);
    } catch (err) {
      console.error('Cache delete error:', err);
    }
  }

  static async delPattern(pattern: string): Promise<void> {
    const client = getRedisClient();
    if (!client) {
      return;
    }

    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch (err) {
      console.error('Cache delete pattern error:', err);
    }
  }
}

export const cacheKeys = {
  feed: (type: string) => `feed:${type}`,
  userProfile: (userId: string) => `user:profile:${userId}`,
  notificationsUnreadCount: (userId: string) => `notifications:unread:${userId}`,
  story: (storyId: string) => `story:${storyId}`,
  character: (characterId: string) => `character:${characterId}`,
  world: (worldId: string) => `world:${worldId}`,
  authorStats: (authorId: string) => `author:stats:${authorId}`,
  hotWorks: 'works:hot',
};
