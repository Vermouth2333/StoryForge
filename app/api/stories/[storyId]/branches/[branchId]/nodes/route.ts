import { getDb, id, nowIso } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ storyId: string; branchId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const params_data = await params;
  const { storyId, branchId } = params_data;
  
  const db = await getDb();
  
  // 验证用户是否是故事作者
  const story = await db.get(
    "SELECT * FROM stories WHERE id = ? AND author_id = ?",
    [storyId, userId]
  );
  
  if (!story) {
    return NextResponse.json({ error: "故事不存在或无权操作" }, { status: 404 });
  }
  
  // 验证分支是否存在
  const branch = await db.get(
    "SELECT * FROM story_branches WHERE id = ? AND story_id = ?",
    [branchId, storyId]
  );
  
  if (!branch) {
    return NextResponse.json({ error: "分支不存在" }, { status: 404 });
  }
  
  const body = await request.json();
  const { title, content, parent_node_id } = body;
  
  if (!title) {
    return NextResponse.json({ error: "节点标题不能为空" }, { status: 400 });
  }
  
  // 创建分支节点
  const nodeId = id("branchnode");
  const now = nowIso();
  
  await db.run(
    `INSERT INTO branch_nodes (id, branch_id, parent_node_id, title, content, created_at) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nodeId, branchId, parent_node_id || null, title, content || "", now]
  );
  
  return NextResponse.json({
    code: 200,
    data: { id: nodeId, branch_id: branchId, title, content, parent_node_id: parent_node_id || null },
    msg: "节点创建成功"
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ storyId: string; branchId: string }> }) {
  const params_data = await params;
  const { storyId, branchId } = params_data;
  
  const db = await getDb();
  
  // 获取分支信息
  const branch = await db.get(
    "SELECT * FROM story_branches WHERE id = ? AND story_id = ?",
    [branchId, storyId]
  );
  
  // 获取分支的所有节点
  const nodes = await db.all(
    `SELECT * FROM branch_nodes 
     WHERE branch_id = ? 
     ORDER BY created_at ASC`,
    [branchId]
  );
  
  // 构建节点树
  const nodeMap = new Map();
  const rootNodes: Record<string, unknown>[] = [];
  
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] });
  }
  
  for (const node of nodes) {
    const nodeWithChildren = nodeMap.get(node.id);
    if (node.parent_node_id) {
      const parent = nodeMap.get(node.parent_node_id);
      if (parent) {
        parent.children.push(nodeWithChildren);
      } else {
        rootNodes.push(nodeWithChildren);
      }
    } else {
      rootNodes.push(nodeWithChildren);
    }
  }
  
  return NextResponse.json({
    code: 200,
    data: {
      branch,
      nodes: rootNodes,
      flatNodes: nodes,
    },
  });
}
