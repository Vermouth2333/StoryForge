"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

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
    } catch {
      setError("创建失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="sf-tag mb-4 inline-flex"
        >
          ← 返回
        </button>
        <h1 className="text-xl font-bold text-[#1F2A44]">创建自定义角色</h1>
        <p className="mt-1 text-sm text-[#5B6B8C]">
          为你的故事创建一个新的角色，详细设定有助于 AI 更好地保持角色一致性。
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="sf-card space-y-5 p-6">
        <div>
          <label className="block text-sm font-medium text-[#1F2A44] mb-1.5">
            角色名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            maxLength={50}
            className="sf-input"
            placeholder="输入角色名称"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#1F2A44] mb-1.5">性别</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="sf-input"
            >
              <option value="">请选择</option>
              <option value="male">男</option>
              <option value="female">女</option>
              <option value="other">其他</option>
              <option value="unknown">未知</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1F2A44] mb-1.5">年龄</label>
            <input
              type="text"
              name="age"
              value={formData.age}
              onChange={handleChange}
              className="sf-input"
              placeholder="如：25岁、青年、中年"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1F2A44] mb-1.5">外貌描述</label>
          <textarea
            name="appearance"
            value={formData.appearance}
            onChange={handleChange}
            rows={3}
            className="sf-input resize-none"
            placeholder="描述角色的外貌特征：身高、体型、发色、穿着等"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1F2A44] mb-1.5">性格特点</label>
          <textarea
            name="personality"
            value={formData.personality}
            onChange={handleChange}
            rows={3}
            className="sf-input resize-none"
            placeholder="描述角色的性格：外向/内向、优点/缺点、价值观等"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1F2A44] mb-1.5">背景故事</label>
          <textarea
            name="background"
            value={formData.background}
            onChange={handleChange}
            rows={4}
            className="sf-input resize-none"
            placeholder="描述角色的过往经历、成长环境、关键记忆等"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1F2A44] mb-1.5">能力与技能</label>
          <textarea
            name="abilities"
            value={formData.abilities}
            onChange={handleChange}
            rows={3}
            className="sf-input resize-none"
            placeholder="描述角色拥有的能力、特长、弱点等"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="sf-btn-primary"
          >
            {loading ? "创建中..." : "创建角色"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="sf-btn-secondary"
          >
            取消
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-xl bg-[#EEF6FF] p-4">
        <h3 className="font-semibold text-[#1F2A44] mb-2">提示</h3>
        <ul className="text-sm text-[#5B6B8C] space-y-1">
          <li>· 创建的角色将自动添加到当前故事的角色列表中</li>
          <li>· 你可以随时在故事体验中使用这个角色</li>
          <li>· 详细角色设定有助于 AI 更好地保持角色一致性</li>
        </ul>
      </div>
    </main>
  );
}
