"use client";

import { useState } from "react";

export interface DerivativeRelation {
  id: string;
  derivedWorkType: "story" | "character" | "world";
  derivedWorkId: string;
  derivedWorkTitle: string;
  derivedWorkAuthor?: string;
  originalWorkType: "story" | "character" | "world";
  originalWorkId: string;
  originalWorkTitle: string;
  originalWorkAuthor?: string;
  relationType: "inspired_by" | "remix" | "continuation";
  note?: string;
  createdAt: string;
}

interface DerivativeChainViewerProps {
  workId: string;
  workType: "story" | "character" | "world";
  initialRelations?: DerivativeRelation[];
}

const relationTypeLabels: Record<string, { label: string; color: string }> = {
  inspired_by: { label: "灵感来源", color: "bg-blue-100 text-blue-800" },
  remix: { label: "改编", color: "bg-purple-100 text-purple-800" },
  continuation: { label: "续作", color: "bg-green-100 text-green-800" },
};

const workTypeLabels: Record<string, string> = {
  story: "故事",
  character: "角色",
  world: "世界",
};

export function DerivativeChainViewer({
  workId,
  workType,
  initialRelations = [],
}: DerivativeChainViewerProps) {
  const [activeTab, setActiveTab] = useState<"original" | "derived">("original");
  const [loading, setLoading] = useState(false);
  const [relations, setRelations] = useState<DerivativeRelation[]>(initialRelations);
  const [selectedRelation, setSelectedRelation] = useState<DerivativeRelation | null>(null);

  const fetchRelations = async (type: "original" | "derived") => {
    setLoading(true);
    try {
      const endpoint =
        type === "original"
          ? `/api/derivative-works/${workType}/${workId}`
          : `/api/derivative-works/chain/${workType}/${workId}`;

      const res = await fetch(endpoint);
      const data = await res.json();

      if (data.code === 200) {
        setRelations(data.data.relations || []);
      }
    } catch (error) {
      console.error("Failed to fetch derivative relations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: "original" | "original" | "derived") => {
    setActiveTab(tab);
    if (relations.length === 0) {
      fetchRelations(tab);
    }
  };

  const getRelationIcon = (type: string) => {
    switch (type) {
      case "inspired_by":
        return "💡";
      case "remix":
        return "🎨";
      case "continuation":
        return "📖";
      default:
        return "🔗";
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => handleTabChange("original")}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === "original"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            原作品
          </button>
          <button
            onClick={() => handleTabChange("derived")}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === "derived"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            衍生作品
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">
            <span className="animate-pulse">加载中...</span>
          </div>
        ) : relations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>暂无{activeTab === "original" ? "原作品" : "衍生作品"}信息</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTab === "original" ? (
              relations.map((relation) => (
                <div
                  key={relation.id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => setSelectedRelation(relation)}
                >
                  <div className="text-2xl">{getRelationIcon(relation.relationType)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{relation.originalWorkTitle}</span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          relationTypeLabels[relation.relationType]?.color
                        }`}
                      >
                        {relationTypeLabels[relation.relationType]?.label}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                        {workTypeLabels[relation.originalWorkType]}
                      </span>
                      {relation.originalWorkAuthor && (
                        <span className="ml-2">作者：{relation.originalWorkAuthor}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-gray-400">→</div>
                  <div className="text-sm text-gray-600">
                    {workTypeLabels[relation.derivedWorkType]}
                  </div>
                </div>
              ))
            ) : (
              relations.map((relation) => (
                <div
                  key={relation.id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => setSelectedRelation(relation)}
                >
                  <div className="text-2xl">{getRelationIcon(relation.relationType)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{relation.derivedWorkTitle}</span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          relationTypeLabels[relation.relationType]?.color
                        }`}
                      >
                        {relationTypeLabels[relation.relationType]?.label}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                        {workTypeLabels[relation.derivedWorkType]}
                      </span>
                      {relation.derivedWorkAuthor && (
                        <span className="ml-2">作者：{relation.derivedWorkAuthor}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-gray-400">←</div>
                  <div className="text-sm text-gray-600">
                    {workTypeLabels[relation.originalWorkType]}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {selectedRelation && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">关系详情</h4>
            <div className="text-sm space-y-1 text-gray-600">
              <p>
                <span className="font-medium">关系类型：</span>
                {relationTypeLabels[selectedRelation.relationType]?.label}
              </p>
              {selectedRelation.note && (
                <p>
                  <span className="font-medium">备注：</span>
                  {selectedRelation.note}
                </p>
              )}
              <p>
                <span className="font-medium">创建时间：</span>
                {new Date(selectedRelation.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => setSelectedRelation(null)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800"
            >
              关闭详情
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 rounded-b-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            共 {relations.length} 个{activeTab === "original" ? "原作品" : "衍生作品"}
          </span>
          <button className="text-blue-600 hover:text-blue-800">
            添加关系
          </button>
        </div>
      </div>
    </div>
  );
}
