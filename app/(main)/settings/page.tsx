"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { replayHeaders } from "@/lib/replay-headers";

type Profile = {
  id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  gender: string | null;
  age: number | null;
  phone_masked: string | null;
  bio: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [bio, setBio] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [worksAction, setWorksAction] = useState<"anonymize_published" | "remove_all">(
    "anonymize_published",
  );
  const [deleteBusy, setDeleteBusy] = useState(false);

  // 模型管理
  const [models, setModels] = useState<Array<{
    id: string; name: string; provider: string; modelName: string;
    baseUrl?: string; hasApiKey: boolean; enabled: boolean;
    defaultTemperature?: number; maxTokens?: number;
  }>>([]);
  const [defaultModelId, setDefaultModelId] = useState("");
  const [showModelForm, setShowModelForm] = useState(false);
  const [editingModel, setEditingModel] = useState<typeof models[number] | null>(null);
  const [modelForm, setModelForm] = useState({
    name: "", provider: "openai" as string, modelName: "", baseUrl: "", apiKey: "",
    defaultTemperature: 0.7, maxTokens: 4096, enabled: true,
  });
  const [modelBusy, setModelBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/profile");
      const json = await res.json();
      if (res.status === 410 || json.code === 410) {
        router.replace("/");
        return;
      }
      if (json.code === 200 && json.data) {
        const p = json.data as Profile;
        setProfile(p);
        setUsername(p.username ?? "");
        setGender(p.gender ?? "");
        setAge(p.age ?? "");
        setBio(p.bio ?? "");
      }
      setLoading(false);
    })();

    void loadModels();
  }, [router]);

  async function loadModels() {
    const res = await fetch("/api/models");
    if (res.ok) {
      const json = await res.json();
      if (json.code === 200) {
        setModels(json.data ?? []);
        setDefaultModelId(json.defaultModelId ?? "");
      }
    }
  }

  async function uploadAvatar(file: File) {
    setAvatarBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      setMsg(json.msg ?? "上传完成");
      if (json.code === 200 && json.data?.avatar_url) {
        setProfile((p) =>
          p ? { ...p, avatar_url: json.data.avatar_url as string } : p,
        );
      }
    } finally {
      setAvatarBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const body: Record<string, unknown> = {
        username: username.trim(),
        bio,
      };
      if (gender.trim()) body.gender = gender.trim();
      else body.gender = "";
      if (age === "") body.age = null;
      else body.age = typeof age === "number" ? age : parseInt(String(age), 10);
      if (phoneTouched) {
        body.phone = phoneInput.replace(/\D/g, "");
        if (!body.phone) body.phone = "";
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.status === 410 || json.code === 410) {
        router.replace("/");
        return;
      }
      setMsg(json.msg ?? "保存成功");
      const reload = await fetch("/api/profile");
      const rj = await reload.json();
      if (rj.code === 200 && rj.data) setProfile(rj.data);
      setPhoneInput("");
      setPhoneTouched(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8FBFF] p-6 text-sm text-[#5B6B8C]">加载中...</main>
    );
  }

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="section-title">账号设置</h2>
          <p className="section-subtitle">管理你的个人信息和账号安全</p>
        </div>
        <Link href="/" className="sf-tag">
          返回首页
        </Link>
      </div>

      {/* 个人信息 */}
      <div className="sf-card p-6">
        <h3 className="text-base font-semibold text-[#1F2A44] mb-6 flex items-center gap-2">
          <span>👤</span> 个人信息
        </h3>

        <div className="space-y-6">
          {/* 头像 */}
          <div>
            <p className="text-sm font-medium text-[#1F2A44] mb-2">头像</p>
            <div className="flex flex-wrap items-center gap-4">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  width={88}
                  height={88}
                  className="h-[88px] w-[88px] rounded-full border-2 border-[#DCE9FF] object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full border-2 border-dashed border-[#DCE9FF] bg-[#F8FBFF] text-sm text-[#5B6B8C] font-medium">
                  {profile?.username?.charAt(0) ?? "用户"}
                </div>
              )}
              <label className="cursor-pointer rounded-xl border border-[#DCE9FF] px-4 py-2 text-sm text-[#1F2A44] hover:bg-[#F8FBFF] transition-colors">
                {avatarBusy ? "上传中..." : "选择图片"}
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  className="hidden"
                  disabled={avatarBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAvatar(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {/* 用户名 */}
          <div>
            <label className="block text-sm font-medium text-[#1F2A44] mb-2">
              用户名（昵称）
            </label>
            <input
              className="sf-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
            />
          </div>

          {/* 性别 */}
          <div>
            <label className="block text-sm font-medium text-[#1F2A44] mb-2">
              性别（可选）
            </label>
            <select className="sf-input" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">请选择</option>
              <option value="男">男</option>
              <option value="女">女</option>
              <option value="其他">其他</option>
            </select>
          </div>

          {/* 年龄 */}
          <div>
            <label className="block text-sm font-medium text-[#1F2A44] mb-2">
              年龄（可选）
            </label>
            <input
              type="number"
              min={0}
              max={130}
              className="sf-input"
              value={age === "" ? "" : age}
              onChange={(e) => {
                const v = e.target.value;
                setAge(v === "" ? "" : Number(v));
              }}
              placeholder="请输入年龄"
            />
          </div>

          {/* 手机号 */}
          <div>
            <label className="block text-sm font-medium text-[#1F2A44] mb-2">
              手机号（可选）
            </label>
            {profile?.phone_masked ? (
              <p className="text-sm text-[#5B6B8C] mb-2">当前：{profile.phone_masked}</p>
            ) : (
              <p className="text-sm text-[#5B6B8C] mb-2">未填写</p>
            )}
            <input
              className="sf-input"
              placeholder="输入11位手机号，仅存储脱敏信息"
              value={phoneInput}
              onChange={(e) => {
                setPhoneInput(e.target.value);
                setPhoneTouched(true);
              }}
            />
          </div>

          {/* 简介 */}
          <div>
            <label className="block text-sm font-medium text-[#1F2A44] mb-2">
              作者简介（最多 500 字）
            </label>
            <textarea
              className="sf-input min-h-28 resize-none"
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="介绍一下你自己..."
            />
          </div>

          {/* 保存按钮 */}
          <button
            type="button"
            className="sf-btn-primary w-full"
            disabled={saving}
            onClick={save}
          >
            {saving ? "保存中..." : "保存更改"}
          </button>

          {/* 提示消息 */}
          {msg && <p className="text-center text-sm text-[#5B6B8C]">{msg}</p>}
        </div>
      </div>

      {/* 安全设置 */}
      <div className="sf-card p-6">
        <h3 className="text-base font-semibold text-[#1F2A44] mb-6 flex items-center gap-2">
          <span>🔒</span> 安全设置
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#F8FBFF] rounded-xl">
            <div>
              <p className="font-medium text-[#1F2A44]">登录方式</p>
              <p className="text-sm text-[#5B6B8C]">当前使用 Google 账号登录</p>
            </div>
            <span className="text-green-500 text-sm font-medium">已绑定</span>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#F8FBFF] rounded-xl">
            <div>
              <p className="font-medium text-[#1F2A44]">账号状态</p>
              <p className="text-sm text-[#5B6B8C]">正常使用中</p>
            </div>
            <span className="text-green-500 text-sm font-medium">✓ 正常</span>
          </div>
        </div>
      </div>

      {/* 模型管理 */}
      <div className="sf-card p-6">
        <h3 className="text-base font-semibold text-[#1F2A44] mb-2 flex items-center gap-2">
          <span>🤖</span> AI 模型管理
        </h3>
        <p className="text-sm text-[#5B6B8C] mb-6">
          添加和管理你的 AI 模型，配置 API Key 后即可在创作中使用。支持 OpenAI、Anthropic、Ollama 等兼容接口。
        </p>

        {/* 模型列表 */}
        {models.length > 0 ? (
          <div className="space-y-3 mb-6">
            {models.map((m) => (
              <div
                key={m.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                  m.id === defaultModelId
                    ? "border-[#5B9DFF] bg-[#F0F6FF]"
                    : "border-[#DCE9FF] bg-[#F8FBFF]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[#1F2A44] truncate">{m.name}</p>
                    {m.id === defaultModelId && (
                      <span className="shrink-0 rounded-full bg-[#5B9DFF] px-2 py-0.5 text-xs text-white">默认</span>
                    )}
                    {!m.enabled && (
                      <span className="shrink-0 rounded-full bg-[#DCE9FF] px-2 py-0.5 text-xs text-[#5B6B8C]">已禁用</span>
                    )}
                  </div>
                  <p className="text-xs text-[#5B6B8C] mt-1">
                    {m.provider} / {m.modelName}
                    {m.hasApiKey ? " · Key 已配置" : " · 未配置 Key"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {m.id !== defaultModelId && m.enabled && (
                    <button
                      className="text-xs text-[#5B9DFF] hover:underline"
                      onClick={async () => {
                        await fetch("/api/settings/model", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ modelId: m.id }),
                        });
                        await loadModels();
                      }}
                    >
                      设为默认
                    </button>
                  )}
                  <button
                    className="text-xs text-[#5B6B8C] hover:text-[#1F2A44]"
                    onClick={() => {
                      setEditingModel(m);
                      setModelForm({
                        name: m.name,
                        provider: m.provider,
                        modelName: m.modelName,
                        baseUrl: m.baseUrl ?? "",
                        apiKey: "",
                        defaultTemperature: m.defaultTemperature ?? 0.7,
                        maxTokens: m.maxTokens ?? 4096,
                        enabled: m.enabled,
                      });
                      setShowModelForm(true);
                    }}
                  >
                    编辑
                  </button>
                  <button
                    className="text-xs text-red-400 hover:text-red-600"
                    onClick={async () => {
                      if (!confirm("确定删除此模型？")) return;
                      await fetch(`/api/models?id=${m.id}`, { method: "DELETE" });
                      await loadModels();
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-6 p-6 rounded-xl border border-dashed border-[#DCE9FF] bg-[#F8FBFF] text-center">
            <p className="text-sm text-[#5B6B8C]">尚未配置任何 AI 模型</p>
            <p className="text-xs text-[#5B6B8C] mt-1">点击下方按钮添加你的第一个模型</p>
          </div>
        )}

        {/* 添加/编辑模型表单 */}
        {showModelForm ? (
          <div className="border border-[#DCE9FF] rounded-xl p-5 space-y-4 bg-white">
            <h4 className="text-sm font-semibold text-[#1F2A44]">
              {editingModel ? "编辑模型" : "添加模型"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#1F2A44] mb-1">显示名称 *</label>
                <input
                  className="sf-input"
                  placeholder="如：GPT-4o"
                  value={modelForm.name}
                  onChange={(e) => setModelForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1F2A44] mb-1">服务商 *</label>
                <select
                  className="sf-input"
                  value={modelForm.provider}
                  onChange={(e) => setModelForm((f) => ({ ...f, provider: e.target.value }))}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="ollama">Ollama (本地)</option>
                  <option value="custom">自定义 (OpenAI 兼容)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1F2A44] mb-1">模型 ID *</label>
                <input
                  className="sf-input"
                  placeholder="如：gpt-4o, claude-3-opus-20240229"
                  value={modelForm.modelName}
                  onChange={(e) => setModelForm((f) => ({ ...f, modelName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1F2A44] mb-1">API Base URL</label>
                <input
                  className="sf-input"
                  placeholder="留空使用默认地址"
                  value={modelForm.baseUrl}
                  onChange={(e) => setModelForm((f) => ({ ...f, baseUrl: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#1F2A44] mb-1">API Key</label>
                <input
                  className="sf-input"
                  type="password"
                  placeholder={editingModel?.hasApiKey ? "留空保持原 Key 不变" : "输入你的 API Key"}
                  value={modelForm.apiKey}
                  onChange={(e) => setModelForm((f) => ({ ...f, apiKey: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1F2A44] mb-1">Temperature</label>
                <input
                  className="sf-input"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={modelForm.defaultTemperature}
                  onChange={(e) => setModelForm((f) => ({ ...f, defaultTemperature: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1F2A44] mb-1">Max Tokens</label>
                <input
                  className="sf-input"
                  type="number"
                  min={1}
                  max={128000}
                  step={1}
                  value={modelForm.maxTokens}
                  onChange={(e) => setModelForm((f) => ({ ...f, maxTokens: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[#1F2A44]">
                <input
                  type="checkbox"
                  checked={modelForm.enabled}
                  onChange={(e) => setModelForm((f) => ({ ...f, enabled: e.target.checked }))}
                />
                启用此模型
              </label>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                className="sf-btn-primary"
                disabled={modelBusy}
                onClick={async () => {
                  if (!modelForm.name.trim() || !modelForm.modelName.trim()) {
                    setMsg("名称和模型 ID 不能为空");
                    return;
                  }
                  setModelBusy(true);
                  setMsg("");
                  try {
                    const payload: Record<string, unknown> = {
                      name: modelForm.name.trim(),
                      provider: modelForm.provider,
                      modelName: modelForm.modelName.trim(),
                      defaultTemperature: modelForm.defaultTemperature,
                      maxTokens: modelForm.maxTokens,
                      enabled: modelForm.enabled,
                    };
                    if (modelForm.baseUrl.trim()) payload.baseUrl = modelForm.baseUrl.trim();
                    if (modelForm.apiKey.trim()) payload.apiKey = modelForm.apiKey.trim();

                    let res: Response;
                    if (editingModel) {
                      payload.id = editingModel.id;
                      res = await fetch("/api/models", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                    } else {
                      res = await fetch("/api/models", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                    }
                    const json = await res.json();
                    if (json.code === 200) {
                      setShowModelForm(false);
                      setEditingModel(null);
                      setModelForm({ name: "", provider: "openai", modelName: "", baseUrl: "", apiKey: "", defaultTemperature: 0.7, maxTokens: 4096, enabled: true });
                      await loadModels();
                      setMsg(editingModel ? "模型已更新" : "模型已添加");
                    } else {
                      setMsg(json.msg ?? "操作失败");
                    }
                  } finally {
                    setModelBusy(false);
                  }
                }}
              >
                {modelBusy ? "保存中..." : editingModel ? "保存更改" : "添加模型"}
              </button>
              <button
                type="button"
                className="sf-btn-secondary"
                onClick={() => {
                  setShowModelForm(false);
                  setEditingModel(null);
                  setModelForm({ name: "", provider: "openai", modelName: "", baseUrl: "", apiKey: "", defaultTemperature: 0.7, maxTokens: 4096, enabled: true });
                }}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="sf-btn-primary"
            onClick={() => setShowModelForm(true)}
          >
            + 添加模型
          </button>
        )}
      </div>

      {/* 危险操作 */}
      <div className="sf-card border-[#FFD6D6] bg-[#FFF8F8] p-6">
        <h3 className="text-base font-semibold text-[#8B2E2E] mb-4 flex items-center gap-2">
          <span>⚠️</span> 账号注销
        </h3>

        <p className="text-sm text-[#5B6B8C] mb-6">
          注销账号将永久删除你的个人信息，请谨慎操作。注销前请选择已发布内容的处理方式。
        </p>

        <div className="space-y-4">
          {/* 确认输入 */}
          <div>
            <label className="block text-sm font-medium text-[#1F2A44] mb-2">
              输入「确认注销」以继续
            </label>
            <input
              className="sf-input"
              placeholder="确认注销"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
          </div>

          {/* 作品处理 */}
          <div>
            <p className="text-sm font-medium text-[#1F2A44] mb-2">已发布内容处理</p>
            <div className="space-y-3">
              <label className="flex cursor-pointer p-3 bg-white rounded-xl border border-[#DCE9FF] hover:border-[#FFD6D6] transition-colors">
                <input
                  type="radio"
                  name="works_action"
                  checked={worksAction === "anonymize_published"}
                  onChange={() => setWorksAction("anonymize_published")}
                  className="mr-3"
                />
                <div>
                  <p className="font-medium text-[#1F2A44]">匿名保留</p>
                  <p className="text-xs text-[#5B6B8C]">已发布内容仍保留，但作者显示为「已注销用户」</p>
                </div>
              </label>
              <label className="flex cursor-pointer p-3 bg-white rounded-xl border border-[#DCE9FF] hover:border-[#FFD6D6] transition-colors">
                <input
                  type="radio"
                  name="works_action"
                  checked={worksAction === "remove_all"}
                  onChange={() => setWorksAction("remove_all")}
                  className="mr-3"
                />
                <div>
                  <p className="font-medium text-[#1F2A44]">彻底删除</p>
                  <p className="text-xs text-[#5B6B8C]">下架并删除全部故事、角色卡、世界及相关数据（不可恢复）</p>
                </div>
              </label>
            </div>
          </div>

          {/* 注销按钮 */}
          <button
            type="button"
            className="w-full rounded-xl border border-[#E08585] bg-white px-4 py-3 text-sm font-semibold text-[#8B2E2E] hover:bg-[#FFF0F0] disabled:opacity-50 transition-colors"
            disabled={deleteBusy || deleteConfirm !== "确认注销"}
            onClick={async () => {
              setDeleteBusy(true);
              setMsg("");
              try {
                const res = await fetch("/api/account/delete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...replayHeaders() },
                  body: JSON.stringify({
                    confirm: deleteConfirm.trim(),
                    works_action: worksAction,
                  }),
                });
                const json = await res.json();
                setMsg(json.msg ?? "");
                if (json.code === 200) {
                  router.replace("/");
                }
              } finally {
                setDeleteBusy(false);
              }
            }}
          >
            {deleteBusy ? "处理中..." : "注销账号"}
          </button>
        </div>
      </div>
    </div>
  );
}
