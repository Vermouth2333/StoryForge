import { getDb, nowIso } from "@/lib/db";

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

interface RagVectorRow {
  id: string;
  type: string;
  resource_id: string;
  resource_type: string;
  world_id: string | null;
  content: string;
  embedding_json: string | null;
}

function toWordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function parseEmbedding(value: string | null): number[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "number")) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function createEmbedding(input: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

  try {
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const emb = json.data?.[0]?.embedding;
    if (!emb || !Array.isArray(emb)) return null;
    return emb;
  } catch {
    return null;
  }
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

  async syncKnowledgeEntries(
    worldId: string,
    entries: Array<{ id: string; name: string; content: string; tags?: string[] }>,
  ): Promise<void> {
    const db = await getDb();
    const existing = await db.all<Array<{ id: string; content: string }>>(
      "SELECT id, content FROM rag_vectors WHERE type = 'knowledge' AND world_id = ?",
      worldId,
    );
    const byId = new Map(existing.map((r) => [r.id, r.content]));

    for (const entry of entries) {
      const ragId = `knowledge_${entry.id}`;
      const mergedContent = [entry.name, entry.content].filter(Boolean).join(" ").slice(0, 4000);
      const oldContent = byId.get(ragId);

      if (oldContent === mergedContent) {
        this.indexKnowledgeEntry({
          id: entry.id,
          name: entry.name,
          content: entry.content,
          world_id: worldId,
          tags: entry.tags,
        });
        continue;
      }

      const embedding = await createEmbedding(mergedContent);
      await db.run(
        `INSERT INTO rag_vectors
        (id, type, resource_id, resource_type, world_id, content, tags_json, embedding_json, updated_at)
         VALUES (?, 'knowledge', ?, 'knowledge', ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           content = excluded.content,
           tags_json = excluded.tags_json,
           embedding_json = excluded.embedding_json,
           updated_at = excluded.updated_at`,
        ragId,
        entry.id,
        worldId,
        mergedContent,
        JSON.stringify(entry.tags || []),
        embedding ? JSON.stringify(embedding) : null,
        nowIso(),
      );

      this.vectorStore.addEntry({
        id: ragId,
        type: "knowledge",
        content: mergedContent,
        metadata: {
          resourceId: entry.id,
          resourceType: "knowledge",
          tags: entry.tags,
          createdAt: new Date(),
        },
        embedding: embedding || undefined,
      });
    }
  }

  async retrieveKnowledgeForWorld(
    worldId: string,
    query: string,
    options: { limit?: number; minScore?: number } = {},
  ): Promise<Array<{ type: string; resourceId: string; content: string; score: number }>> {
    const { limit = 5, minScore = 0.1 } = options;
    const db = await getDb();
    const rows = await db.all<RagVectorRow[]>(
      `SELECT id, type, resource_id, resource_type, world_id, content, embedding_json
       FROM rag_vectors
       WHERE type = 'knowledge' AND world_id = ?`,
      worldId,
    );
    if (rows.length === 0) return [];

    const queryEmbedding = await createEmbedding(query);
    if (queryEmbedding) {
      const scored = rows
        .map((row) => {
          const emb = parseEmbedding(row.embedding_json);
          return {
            row,
            score: emb ? cosineSimilarity(queryEmbedding, emb) : -1,
          };
        })
        .filter((x) => x.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ row, score }) => ({
          type: row.resource_type,
          resourceId: row.resource_id,
          content: row.content.slice(0, 500),
          score,
        }));
      if (scored.length > 0) return scored;
    }

    // Fallback: keyword retrieval from persisted content when embedding is unavailable.
    const words = toWordTokens(query);
    const keyword = rows
      .map((row) => {
        const haystack = row.content.toLowerCase();
        const matches = words.reduce((acc, word) => (haystack.includes(word) ? acc + 1 : acc), 0);
        return {
          row,
          score: words.length > 0 ? matches / words.length : 0,
        };
      })
      .filter((x) => x.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ row, score }) => ({
        type: row.resource_type,
        resourceId: row.resource_id,
        content: row.content.slice(0, 500),
        score,
      }));
    return keyword;
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

    const maxChars = Math.max(200, maxTokens * 4);
    const compactSections: string[] = [];
    let used = 0;
    for (const section of contextSections) {
      if (used >= maxChars) break;
      const rest = maxChars - used;
      const piece = section.slice(0, rest);
      compactSections.push(piece);
      used += piece.length;
    }

    return (
      "参考信息：\n" +
      compactSections.join("\n\n") +
      "\n\n请基于以上参考信息回答用户的问题。"
    );
  }

  clear(): void {
    this.vectorStore.clear();
  }
}
