"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  }, [router]);

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
                  headers: { "Content-Type": "application/json" },
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
