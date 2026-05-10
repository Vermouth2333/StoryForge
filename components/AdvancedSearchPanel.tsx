"use client";

import { useState } from "react";

export interface SearchFilters {
  search: string;
  tags: string[];
  author: string;
  minRating: number;
  startDate: string;
  endDate: string;
  sort: "latest" | "updated" | "recommended";
  kind: "story" | "character" | "world";
}

interface AdvancedSearchPanelProps {
  onSearch: (filters: SearchFilters) => void;
  initialFilters?: Partial<SearchFilters>;
  availableTags?: string[];
}

const defaultFilters: SearchFilters = {
  search: "",
  tags: [],
  author: "",
  minRating: 0,
  startDate: "",
  endDate: "",
  sort: "recommended",
  kind: "story",
};

export function AdvancedSearchPanel({
  onSearch,
  initialFilters,
  availableTags = [],
}: AdvancedSearchPanelProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    ...defaultFilters,
    ...initialFilters,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: name === "minRating" ? Number(value) : value,
    }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !filters.tags.includes(tagInput.trim())) {
      setFilters((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleReset = () => {
    setFilters(defaultFilters);
    onSearch(defaultFilters);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              name="search"
              value={filters.search}
              onChange={handleChange}
              placeholder="搜索故事、角色、世界..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={() => onSearch(filters)}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            搜索
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {isExpanded ? "收起筛选" : "高级筛选"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                内容类型
              </label>
              <select
                name="kind"
                value={filters.kind}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="story">故事</option>
                <option value="character">角色</option>
                <option value="world">世界</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                排序方式
              </label>
              <select
                name="sort"
                value={filters.sort}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="recommended">推荐</option>
                <option value="latest">最新</option>
                <option value="updated">最近更新</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              作者
            </label>
            <input
              type="text"
              name="author"
              value={filters.author}
              onChange={handleChange}
              placeholder="输入作者名称"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              标签筛选
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {filters.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-blue-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                placeholder="添加标签"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
              >
                添加
              </button>
            </div>
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-xs text-gray-500 mr-2">热门标签：</span>
                {availableTags.slice(0, 10).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (!filters.tags.includes(tag)) {
                        setFilters((prev) => ({
                          ...prev,
                          tags: [...prev.tags, tag],
                        }));
                      }
                    }}
                    className="px-2 py-0.5 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                最低评分
              </label>
              <select
                name="minRating"
                value={filters.minRating}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>不限</option>
                <option value={1}>1星以上</option>
                <option value={2}>2星以上</option>
                <option value={3}>3星以上</option>
                <option value={4}>4星以上</option>
                <option value={5}>5星</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                开始日期
              </label>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                结束日期
              </label>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              重置
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              应用筛选
            </button>
          </div>
        </form>
      )}

      {(filters.tags.length > 0 ||
        filters.author ||
        filters.minRating > 0 ||
        filters.startDate ||
        filters.endDate) && (
        <div className="px-4 py-2 bg-blue-50 border-t border-gray-200 text-sm">
          <span className="text-gray-600">当前筛选：</span>
          {filters.tags.map((tag) => (
            <span key={tag} className="ml-2 text-blue-600">
              #{tag}
            </span>
          ))}
          {filters.author && (
            <span className="ml-2 text-blue-600">作者: {filters.author}</span>
          )}
          {filters.minRating > 0 && (
            <span className="ml-2 text-blue-600">{filters.minRating}星以上</span>
          )}
          {(filters.startDate || filters.endDate) && (
            <span className="ml-2 text-blue-600">
              {filters.startDate || "..."} - {filters.endDate || "..."}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
