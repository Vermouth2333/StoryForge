export interface UserProfile {
  userId: string;
  preferredTags: string[];
  followedAuthors: string[];
  recentLikes: string[];
  readingHistory: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RecommendationScore {
  workId: string;
  workType: "story" | "character" | "world";
  totalScore: number;
  breakdown: {
    likeScore: number;
    followScore: number;
    tagMatchScore: number;
    freshnessScore: number;
  };
}

export class RecommendationEngine {
  private static readonly WEIGHTS = {
    like: 0.45,
    follow: 0.25,
    tagMatch: 0.20,
    freshness: 0.10,
  };

  private static readonly FRESHNESS_DECAY_DAYS = 30;
  private static readonly MAX_FRESHNESS_DAYS = 365;

  static buildUserProfile(
    userId: string,
    likes: Array<{ target_type: string; target_id: string; created_at: string }>,
    follows: Array<{ author_id: string; created_at: string }>,
    viewHistory: Array<{ target_id: string; viewed_at: string }>,
    likedTags: string[]
  ): UserProfile {
    const now = new Date();

    const followedAuthors = follows.map((f) => f.author_id);

    const recentLikes = likes
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50)
      .map((l) => l.target_id);

    const readingHistory = viewHistory
      .sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime())
      .slice(0, 100)
      .map((v) => v.target_id);

    const preferredTags = this.extractPreferredTags(likedTags, readingHistory);

    return {
      userId,
      preferredTags,
      followedAuthors,
      recentLikes,
      readingHistory,
      createdAt: now,
      updatedAt: now,
    };
  }

  private static extractPreferredTags(likedTags: string[], viewHistory: string[]): string[] {
    const tagFrequency: Record<string, number> = {};

    likedTags.forEach((tag, idx) => {
      const weight = 1.0 - idx * 0.02;
      tagFrequency[tag] = (tagFrequency[tag] || 0) + weight;
    });

    return Object.entries(tagFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag]) => tag);
  }

  static calculateLikeScore(
    likeCount: number,
    favoriteCount: number,
    maxLikes: number = 1000
  ): number {
    const totalEngagement = likeCount + favoriteCount * 0.5;
    return Math.min(totalEngagement / maxLikes, 1.0);
  }

  static calculateFollowScore(
    authorFollowers: number,
    maxFollowers: number = 10000
  ): number {
    return Math.min(authorFollowers / maxFollowers, 1.0);
  }

  static calculateTagMatchScore(
    workTags: string[],
    userPreferredTags: string[]
  ): number {
    if (!workTags.length || !userPreferredTags.length) {
      return 0;
    }

    const matches = workTags.filter((tag) => userPreferredTags.includes(tag));
    return matches.length / Math.max(workTags.length, userPreferredTags.length);
  }

  static calculateFreshnessScore(publishDate: Date | string): number {
    const now = new Date();
    const publishTime = typeof publishDate === "string" ? new Date(publishDate) : publishDate;

    const daysSincePublish = Math.floor(
      (now.getTime() - publishTime.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSincePublish <= 0) {
      return 1.0;
    }

    const decayFactor = Math.pow(
      0.5,
      daysSincePublish / this.FRESHNESS_DECAY_DAYS
    );

    const cappedDays = Math.min(daysSincePublish, this.MAX_FRESHNESS_DAYS);
    const freshnessFactor = 1 - cappedDays / this.MAX_FRESHNESS_DAYS;

    return decayFactor * 0.7 + freshnessFactor * 0.3;
  }

  static calculateWorkScore(
    work: {
      id: string;
      type: "story" | "character" | "world";
      like_count: number;
      favorite_count: number;
      author_id: string;
      tags_json: string;
      publish_at: string;
    },
    profile: UserProfile,
    authorFollowers: number
  ): RecommendationScore {
    const likeScore = this.calculateLikeScore(work.like_count, work.favorite_count);
    const followScore = this.calculateFollowScore(authorFollowers);

    let workTags: string[] = [];
    try {
      workTags = JSON.parse(work.tags_json || "[]");
    } catch {}

    const tagMatchScore = this.calculateTagMatchScore(workTags, profile.preferredTags);
    const freshnessScore = this.calculateFreshnessScore(work.publish_at);

    const totalScore =
      likeScore * this.WEIGHTS.like +
      followScore * this.WEIGHTS.follow +
      tagMatchScore * this.WEIGHTS.tagMatch +
      freshnessScore * this.WEIGHTS.freshness;

    return {
      workId: work.id,
      workType: work.type,
      totalScore,
      breakdown: {
        likeScore,
        followScore,
        tagMatchScore,
        freshnessScore,
      },
    };
  }

  static sortByRecommendationScore<T extends {
    id: string;
    type: "story" | "character" | "world";
    like_count: number;
    favorite_count: number;
    author_id: string;
    tags_json: string;
    publish_at: string;
  }>(
    works: T[],
    profile: UserProfile,
    authorFollowersMap: Record<string, number>
  ): T[] {
    const scored = works.map((work) => ({
      work,
      score: this.calculateWorkScore(
        {
          ...work,
          type: work.type,
        },
        profile,
        authorFollowersMap[work.author_id] || 0
      ),
    }));

    return scored
      .sort((a, b) => b.score.totalScore - a.score.totalScore)
      .map((item) => item.work);
  }
}
