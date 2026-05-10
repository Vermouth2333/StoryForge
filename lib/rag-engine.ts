export interface VectorEntry {
  id: string;
  type: "character" | "world" | "knowledge" | "story";
  content: string;
  metadata: {
    resourceId: string;
    resourceType: string;
    tags?: string[];
    createdAt: Date;
  };
  embedding?: number[];
}

export interface SearchResult {
  entry: VectorEntry;
  score: number;
}

export class VectorStore {
  private static instance: VectorStore | null = null;
  private vectors: Map<string, VectorEntry> = new Map();
  private index: Map<string, Set<string>> = new Map();

  static getInstance(): VectorStore {
    if (!VectorStore.instance) {
      VectorStore.instance = new VectorStore();
    }
    return VectorStore.instance;
  }

  addEntry(entry: VectorEntry): void {
    this.vectors.set(entry.id, entry);

    if (entry.metadata.tags) {
      entry.metadata.tags.forEach((tag) => {
        if (!this.index.has(tag)) {
          this.index.set(tag, new Set());
        }
        this.index.get(tag)!.add(entry.id);
      });
    }
  }

  getEntry(id: string): VectorEntry | undefined {
    return this.vectors.get(id);
  }

  searchByTag(tag: string, limit: number = 10): VectorEntry[] {
    const ids = this.index.get(tag);
    if (!ids) {
      return [];
    }
    return Array.from(ids)
      .map((id) => this.vectors.get(id))
      .filter((entry): entry is VectorEntry => entry !== undefined)
      .slice(0, limit);
  }

  searchByContent(query: string, limit: number = 10): VectorEntry[] {
    const queryWords = query.toLowerCase().split(/\s+/);
    const scored: Array<{ entry: VectorEntry; score: number }> = [];

    this.vectors.forEach((entry) => {
      const content = entry.content.toLowerCase();
      let matches = 0;

      queryWords.forEach((word) => {
        if (content.includes(word)) {
          matches++;
        }
      });

      if (matches > 0) {
        const score = matches / queryWords.length;
        scored.push({ entry, score });
      }
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.entry);
  }

  deleteEntry(id: string): void {
    const entry = this.vectors.get(id);
    if (entry) {
      if (entry.metadata.tags) {
        entry.metadata.tags.forEach((tag) => {
          const tagSet = this.index.get(tag);
          if (tagSet) {
            tagSet.delete(id);
            if (tagSet.size === 0) {
              this.index.delete(tag);
            }
          }
        });
      }
      this.vectors.delete(id);
    }
  }

  clear(): void {
    this.vectors.clear();
    this.index.clear();
  }

  size(): number {
    return this.vectors.size;
  }
}

export class RagEngine {
  private vectorStore: VectorStore;

  constructor() {
    this.vectorStore = VectorStore.getInstance();
  }

  indexCharacter(character: {
    id: string;
    name: string;
    personality?: string;
    background?: string;
    abilities?: string;
    tags?: string[];
  }): void {
    const content = [
      character.name,
      character.personality || "",
      character.background || "",
      character.abilities || "",
    ]
      .filter(Boolean)
      .join(" ");

    this.vectorStore.addEntry({
      id: `char_${character.id}`,
      type: "character",
      content,
      metadata: {
        resourceId: character.id,
        resourceType: "character",
        tags: character.tags,
        createdAt: new Date(),
      },
    });
  }

  indexWorld(world: {
    id: string;
    name: string;
    summary?: string;
    tags?: string[];
  }): void {
    const content = [world.name, world.summary || ""].filter(Boolean).join(" ");

    this.vectorStore.addEntry({
      id: `world_${world.id}`,
      type: "world",
      content,
      metadata: {
        resourceId: world.id,
        resourceType: "world",
        tags: world.tags,
        createdAt: new Date(),
      },
    });
  }

  indexKnowledgeEntry(entry: {
    id: string;
    name: string;
    content: string;
    world_id: string;
    tags?: string[];
  }): void {
    const content = [entry.name, entry.content].filter(Boolean).join(" ");

    this.vectorStore.addEntry({
      id: `knowledge_${entry.id}`,
      type: "knowledge",
      content,
      metadata: {
        resourceId: entry.id,
        resourceType: "knowledge",
        tags: entry.tags,
        createdAt: new Date(),
      },
    });
  }

  indexStoryChapter(chapter: {
    id: string;
    story_id: string;
    title: string;
    content: string;
    tags?: string[];
  }): void {
    const content = [chapter.title, chapter.content].filter(Boolean).join(" ");

    this.vectorStore.addEntry({
      id: `chapter_${chapter.id}`,
      type: "story",
      content,
      metadata: {
        resourceId: chapter.id,
        resourceType: "chapter",
        tags: chapter.tags,
        createdAt: new Date(),
      },
    });
  }

  retrieve(
    query: string,
    options: {
      types?: Array<"character" | "world" | "knowledge" | "story">;
      limit?: number;
      minScore?: number;
    } = {}
  ): Array<{ type: string; resourceId: string; content: string; score: number }> {
    const { types, limit = 5, minScore = 0.1 } = options;

    const results = this.vectorStore.searchByContent(query, limit * 2);

    const filtered = results
      .filter((entry) => !types || types.includes(entry.type))
      .map((entry) => ({
        type: entry.metadata.resourceType,
        resourceId: entry.metadata.resourceId,
        content: entry.content.slice(0, 500),
        score: 1.0,
      }))
      .filter((result) => result.score >= minScore)
      .slice(0, limit);

    return filtered;
  }

  buildContextPrompt(query: string, maxTokens: number = 2000): string {
    const relevantContent = this.retrieve(query, { limit: 3 });

    if (relevantContent.length === 0) {
      return "";
    }

    const contextSections = relevantContent.map(
      (item) => `[${item.type}] ${item.content}`
    );

    return (
      "参考信息：\n" +
      contextSections.join("\n\n") +
      "\n\n请基于以上参考信息回答用户的问题。"
    );
  }

  clear(): void {
    this.vectorStore.clear();
  }
}
