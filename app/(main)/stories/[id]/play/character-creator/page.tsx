"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";

export default function CharacterCreatorPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [formData, setFormData] = useState({
    name: "",
    gender: "",
    age: "",
    appearance: "",
    personality: "",
    background: "",
    abilities: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/stories/${storyId}/custom-characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.code === 200) {
        router.push(`/stories/${storyId}/play`);
      } else {
        setError(data.msg || "创建失败");
      }
    } catch (err) {
      setError("创建失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-blue-500 hover:text-blue-600 mb-4"
          >
            ← 返回
          </button>
          <h1 className="text-2xl font-bold text-gray-900">创建自定义角色</h1>
          <p className="text-gray-600 mt-2">
            为你的故事创建一个新的角色，可以选择基于现有角色卡模板或从头创建。
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                角色名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                maxLength={50}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="输入角色名称"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">性别</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">请选择</option>
                  <option value="male">男</option>
                  <option value="female">女</option>
                  <option value="other">其他</option>
                  <option value="unknown">未知</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">年龄</label>
                <input
                  type="text"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：25岁、青年、中年"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">外貌描述</label>
              <textarea
                name="appearance"
                value={formData.appearance}
                onChange={handleChange}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="描述角色的外貌特征：身高、体型、发色、穿着等"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">性格特点</label>
              <textarea
                name="personality"
                value={formData.personality}
                onChange={handleChange}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="描述角色的性格：外向/内向、优点/缺点、价值观等"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">背景故事</label>
              <textarea
                name="background"
                value={formData.background}
                onChange={handleChange}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="描述角色的过往经历、成长环境、关键记忆等"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">能力与技能</label>
              <textarea
                name="abilities"
                value={formData.abilities}
                onChange={handleChange}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="描述角色拥有的能力、特长、弱点等"
              />
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? "创建中..." : "创建角色"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              取消
            </button>
          </div>
        </form>

        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">提示</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 创建的角色将自动添加到当前故事的的角色列表中</li>
            <li>• 你可以随时在故事体验中使用这个角色</li>
            <li>• 详细角色设定有助于 AI 更好地保持角色一致性</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
