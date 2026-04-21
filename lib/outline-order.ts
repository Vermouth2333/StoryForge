export type OutlineNode = {
  id: string;
  parent_id: string | null;
  title: string;
  type: string;
  sort_order: number;
  content: string;
};

/** 文档：同级 sort_order；深度优先遍历子树 */
export function orderedOutline(nodes: OutlineNode[]): OutlineNode[] {
  const children = new Map<string | null, OutlineNode[]>();
  for (const n of nodes) {
    const p = n.parent_id;
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(n);
  }
  for (const [, arr] of children) {
    arr.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  }
  const out: OutlineNode[] = [];
  function walk(pid: string | null) {
    const ch = children.get(pid) ?? [];
    for (const n of ch) {
      out.push(n);
      walk(n.id);
    }
  }
  walk(null);
  return out;
}

export function depthOf(nodes: OutlineNode[], id: string): number {
  let d = 0;
  let cur: OutlineNode | undefined = nodes.find((x) => x.id === id);
  while (cur?.parent_id) {
    d++;
    cur = nodes.find((x) => x.id === cur!.parent_id);
  }
  return d;
}
