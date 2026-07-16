"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

type RelationData = {
  id: string;
  character_left_id: string;
  character_right_id: string;
  relation_type: string;
  description: string;
  name_left: string | null;
  name_right: string | null;
};

type GraphNode = d3.SimulationNodeDatum & {
  id: string;
  name: string;
};

type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
  relationType: string;
  description: string;
  relationId: string;
  linkIndex: number;
  linkTotal: number;
};

function relationPairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildGraphLinks(relations: RelationData[]): GraphLink[] {
  const pairCounts = new Map<string, number>();
  for (const r of relations) {
    const key = relationPairKey(r.character_left_id, r.character_right_id);
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }

  const pairSeen = new Map<string, number>();
  return relations.map((r) => {
    const key = relationPairKey(r.character_left_id, r.character_right_id);
    const linkIndex = pairSeen.get(key) ?? 0;
    pairSeen.set(key, linkIndex + 1);
    return {
      source: r.character_left_id,
      target: r.character_right_id,
      relationType: r.relation_type,
      description: r.description,
      relationId: r.id,
      linkIndex,
      linkTotal: pairCounts.get(key) ?? 1,
    };
  });
}

function linkPath(d: GraphLink) {
  const sx = (d.source as GraphNode).x!;
  const sy = (d.source as GraphNode).y!;
  const tx = (d.target as GraphNode).x!;
  const ty = (d.target as GraphNode).y!;
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = (d.linkIndex - (d.linkTotal - 1) / 2) * 36;
  const cx = (sx + tx) / 2 + (-dy / dist) * offset;
  const cy = (sy + ty) / 2 + (dx / dist) * offset;
  return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
}

function linkLabelPoint(d: GraphLink) {
  const sx = (d.source as GraphNode).x!;
  const sy = (d.source as GraphNode).y!;
  const tx = (d.target as GraphNode).x!;
  const ty = (d.target as GraphNode).y!;
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = (d.linkIndex - (d.linkTotal - 1) / 2) * 36;
  const cx = (sx + tx) / 2 + (-dy / dist) * offset;
  const cy = (sy + ty) / 2 + (dx / dist) * offset;
  const t = 0.5;
  const x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * tx;
  const y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ty;
  return { x, y };
}

const RELATION_COLORS: Record<string, string> = {
  "敌对": "#ef4444",
  "盟友": "#22c55e",
  "亲属": "#f59e0b",
  "恋人": "#ec4899",
  "上下级": "#6366f1",
  "合作": "#3b82f6",
};

export function RelationGraph({
  relations,
  onDelete,
}: {
  relations: RelationData[];
  onDelete: (id: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || relations.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = 400;

    // 构建节点和连线
    const nodeMap = new Map<string, string>();
    for (const r of relations) {
      const leftName = r.name_left || r.character_left_id.slice(0, 6);
      const rightName = r.name_right || r.character_right_id.slice(0, 6);
      nodeMap.set(r.character_left_id, leftName);
      nodeMap.set(r.character_right_id, rightName);
    }

    const nodes: GraphNode[] = Array.from(nodeMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));

    const links: GraphLink[] = buildGraphLinks(relations);

    const g = svg.append("g");

    // 缩放
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    // 力仿真
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(40));

    // 连线（同一对角色多条关系时用曲线错开）
    const link = g.append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", (d) => RELATION_COLORS[d.relationType] || "#94a3b8")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.7);

    // 连线标签
    const linkLabel = g.append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", (d) => RELATION_COLORS[d.relationType] || "#94a3b8")
      .attr("font-weight", 600)
      .text((d) => d.relationType);

    // 节点组
    const node = g.append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    // 节点圆
    node.append("circle")
      .attr("r", 22)
      .attr("fill", "#EEF6FF")
      .attr("stroke", "#5B9DFF")
      .attr("stroke-width", 2);

    // 节点文字
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("fill", "#1F2A44")
      .text((d) => d.name.length > 4 ? d.name.slice(0, 4) + "…" : d.name);

    // 仿真 tick
    simulation.on("tick", () => {
      link.attr("d", linkPath);

      linkLabel.attr("x", (d) => linkLabelPoint(d).x).attr("y", (d) => linkLabelPoint(d).y - 6);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [relations]);

  if (relations.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-[#DCE9FF] text-sm text-[#5B6B8C]">
        添加人物关系后，图谱将在此展示
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <svg
        ref={svgRef}
        width="100%"
        height={400}
        className="rounded-xl border border-[#DCE9FF] bg-white"
      />
      {/* 图例 */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(RELATION_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {type}
          </span>
        ))}
      </div>
      {/* 关系列表 */}
      <ul className="space-y-2 text-xs">
        {relations.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#F8FBFF] p-2.5">
            <span className="text-[#1F2A44]">
              <span className="font-medium">{r.name_left || r.character_left_id.slice(0, 6)}</span>
              <span
                className="mx-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  color: RELATION_COLORS[r.relation_type] || "#94a3b8",
                  background: `${RELATION_COLORS[r.relation_type] || "#94a3b8"}18`,
                }}
              >
                {r.relation_type}
              </span>
              <span className="font-medium">{r.name_right || r.character_right_id.slice(0, 6)}</span>
              {r.description && <span className="ml-2 text-[#5B6B8C]">— {r.description}</span>}
            </span>
            <button
              type="button"
              className="shrink-0 text-red-500 hover:text-red-700"
              onClick={() => onDelete(r.id)}
            >
              删除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
