export interface GraphNode {
  id: string;
  label: string;
  type: 'character' | 'location' | 'item' | 'organization' | 'event';
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  properties?: Record<string, unknown>;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface EntryLike {
  id?: string;
  name?: string;
  title?: string;
  [key: string]: unknown;
}

interface CharacterLike {
  id: string;
  name?: string;
  title?: string;
  gender?: string;
  personality?: string;
  [key: string]: unknown;
}

interface WorldLike {
  name?: string;
  knowledge_entries?: EntryLike[];
  [key: string]: unknown;
}

export class KnowledgeGraphBuilder {
  static buildFromStory(
    story: Record<string, unknown>,
    characters: CharacterLike[],
    world: WorldLike | null,
    chapters: Record<string, unknown>[]
  ): KnowledgeGraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    characters.forEach((char, index) => {
      nodes.push({
        id: `char-${char.id}`,
        label: char.name || char.title || char.id,
        type: 'character',
        properties: {
          gender: char.gender,
          personality: char.personality,
        },
      });
    });

    if (world) {
      if (world.name) {
        nodes.push({
          id: `world`,
          label: world.name,
          type: 'location',
        });
      }

      if (world.knowledge_entries) {
        world.knowledge_entries.forEach((entry: EntryLike, index: number) => {
          const entryType = this.guessEntryType(entry.name || entry.title || "");
          const nodeId = `entry-${entry.id || index}`;
          nodes.push({
            id: nodeId,
            label: entry.name || entry.title || "",
            type: entryType,
          });

          if (world.name) {
            edges.push({
              id: `edge-world-${index}`,
              source: `world`,
              target: nodeId,
              label: 'contains',
            });
          }
        });
      }
    }

    if (characters.length > 1) {
      characters.forEach((charA, i) => {
        characters.slice(i + 1).forEach((charB, j) => {
          edges.push({
            id: `edge-char-${i}-${j}`,
            source: `char-${charA.id}`,
            target: `char-${charB.id}`,
            label: 'knows',
          });
        });
      });
    }

    return { nodes, edges };
  }

  private static guessEntryType(name: string): GraphNode['type'] {
    const lower = name.toLowerCase();
    if (lower.includes('地') || lower.includes('城') || lower.includes('国')) {
      return 'location';
    }
    if (lower.includes('组织') || lower.includes('会') || lower.includes('团')) {
      return 'organization';
    }
    if (lower.includes('物品') || lower.includes('剑') || lower.includes('书')) {
      return 'item';
    }
    if (lower.includes('事件') || lower.includes('战') || lower.includes('会')) {
      return 'event';
    }
    return 'item';
  }
}
