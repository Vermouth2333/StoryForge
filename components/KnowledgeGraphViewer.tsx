"use client";

import { useEffect, useRef, useState } from "react";

interface GraphNode {
  id: string;
  label: string;
  type: "character" | "location" | "item" | "organization" | "event";
  x?: number;
  y?: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

interface KnowledgeGraphViewerProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
}

export function KnowledgeGraphViewer({
  nodes,
  edges,
  width = 800,
  height = 600,
}: KnowledgeGraphViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const nodeColors: Record<string, string> = {
    character: "#5B9DFF",
    location: "#52c41a",
    item: "#fa8c16",
    organization: "#722ed1",
    event: "#eb2f96",
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const nodeMap = new Map<string, GraphNode>();
    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      const radius = Math.min(width, height) * 0.35;
      const centerX = width / 2;
      const centerY = height / 2;
      nodeMap.set(node.id, {
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    edges.forEach((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      if (sourceNode && targetNode && sourceNode.x && sourceNode.y && targetNode.x && targetNode.y) {
        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        ctx.strokeStyle = "#d9d9d9";
        ctx.lineWidth = 1;
        ctx.stroke();

        const midX = (sourceNode.x + targetNode.x) / 2;
        const midY = (sourceNode.y + targetNode.y) / 2;
        ctx.fillStyle = "#8c8c8c";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(edge.label, midX, midY - 5);
      }
    });

    nodeMap.forEach((node) => {
      if (node.x && node.y) {
        const isHovered = hoveredNode === node.id;
        const isSelected = selectedNode === node.id;
        const radius = isHovered || isSelected ? 14 : 10;

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = nodeColors[node.type] || "#999";
        ctx.fill();

        if (isHovered || isSelected) {
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const initial = node.label.charAt(0);
        ctx.fillText(initial, node.x, node.y);

        ctx.fillStyle = "#333";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.label, node.x, node.y + radius + 15);
      }
    });
  }, [nodes, edges, width, height, hoveredNode, selectedNode]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dpr = window.devicePixelRatio || 1;
    const scaledX = x * dpr;
    const scaledY = y * dpr;

    const nodeMap = new Map<string, GraphNode>();
    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      const radius = Math.min(width, height) * 0.35;
      const centerX = width / 2;
      const centerY = height / 2;
      nodeMap.set(node.id, {
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    let foundNode: string | null = null;
    nodeMap.forEach((node) => {
      if (node.x && node.y) {
        const distance = Math.sqrt(Math.pow(scaledX - node.x * dpr, 2) + Math.pow(scaledY - node.y * dpr, 2));
        if (distance < 20) {
          foundNode = node.id;
        }
      }
    });

    setHoveredNode(foundNode);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dpr = window.devicePixelRatio || 1;
    const scaledX = x * dpr;
    const scaledY = y * dpr;

    const nodeMap = new Map<string, GraphNode>();
    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      const radius = Math.min(width, height) * 0.35;
      const centerX = width / 2;
      const centerY = height / 2;
      nodeMap.set(node.id, {
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    let foundNode: string | null = null;
    nodeMap.forEach((node) => {
      if (node.x && node.y) {
        const distance = Math.sqrt(Math.pow(scaledX - node.x * dpr, 2) + Math.pow(scaledY - node.y * dpr, 2));
        if (distance < 20) {
          foundNode = node.id;
        }
      }
    });

    setSelectedNode(foundNode);
  };

  const selectedNodeData = nodes.find((n) => n.id === selectedNode);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        style={{ width, height }}
        className="border border-gray-200 rounded-lg cursor-pointer"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      <div className="absolute top-4 left-4 bg-white bg-opacity-90 rounded-lg p-3 shadow-sm">
        <h4 className="font-semibold text-sm mb-2">图例</h4>
        <div className="space-y-1">
          {Object.entries(nodeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="capitalize">
                {type === "character" && "角色"}
                {type === "location" && "地点"}
                {type === "item" && "物品"}
                {type === "organization" && "组织"}
                {type === "event" && "事件"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {selectedNodeData && (
        <div className="absolute top-4 right-4 bg-white rounded-lg p-4 shadow-sm max-w-xs">
          <h4 className="font-semibold text-sm mb-1">{selectedNodeData.label}</h4>
          <p className="text-xs text-gray-500 capitalize">
            {selectedNodeData.type === "character" && "角色"}
            {selectedNodeData.type === "location" && "地点"}
            {selectedNodeData.type === "item" && "物品"}
            {selectedNodeData.type === "organization" && "组织"}
            {selectedNodeData.type === "event" && "事件"}
          </p>
        </div>
      )}

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          暂无知识图谱数据
        </div>
      )}
    </div>
  );
}
