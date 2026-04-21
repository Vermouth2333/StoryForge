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
      setMsg(json.msg ?? "完成");
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
      setMsg(json.msg ?? "完成");
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
    <main className="mx-auto max-w-xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1F2A44]">设置</h1>
          <p className="mt-1 text-sm text-[#5B6B8C]">
            文档 2.2：昵称、性别、年龄、联系方式（脱敏）、作者简介
          </p>
        </div>
        <Link href="/" className="sf-tag">
          返回首页
        </Link>
      </div>

      <div className="sf-card space-y-4 p-5">
        <div>
          <p className="text-sm font-medium text-[#1F2A44]">头像</p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt=""
                width={88}
                height={88}
                className="h-[88px] w-[88px] rounded-full border border-[#DCE9FF] object-cover"
              />
            ) : (
              <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full border border-dashed border-[#DCE9FF] bg-[#F8FBFF] text-xs text-[#5B6B8C]">
                无头像
              </div>
            )}
            <label className="cursor-pointer rounded-lg border border-[#DCE9FF] px-3 py-2 text-sm text-[#1F2A44] hover:bg-[#F8FBFF]">
              {avatarBusy ? "上传中…" : "选择 JPG/PNG（≤5MB）"}
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

        <label className="block text-sm font-medium text-[#1F2A44]">
          用户名（昵称）
          <input className="sf-input mt-1" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>

        <label className="block text-sm font-medium text-[#1F2A44]">
          性别（可选）
          <input className="sf-input mt-1" value={gender} onChange={(e) => setGender(e.target.value)} />
        </label>

        <label className="block text-sm font-medium text-[#1F2A44]">
          年龄（可选）
          <input
            type="number"
            min={0}
            max={130}
            className="sf-input mt-1"
            value={age === "" ? "" : age}
            onChange={(e) => {
              const v = e.target.value;
              setAge(v === "" ? "" : Number(v));
            }}
          />
        </label>

        <div>
          <label className="block text-sm font-medium text-[#1F2A44]">
            手机号（可选，仅存储脱敏）
          </label>
          {profile?.phone_masked ? (
            <p className="mt-1 text-sm text-[#5B6B8C]">当前：{profile.phone_masked}</p>
          ) : (
            <p className="mt-1 text-sm text-[#5B6B8C]">未填写</p>
          )}
          <input
            className="sf-input mt-2"
            placeholder="输入 11 位大陆手机号以更新；留空并保存可清空"
            value={phoneInput}
            onChange={(e) => {
              setPhoneInput(e.target.value);
              setPhoneTouched(true);
            }}
          />
        </div>

        <label className="block text-sm font-medium text-[#1F2A44]">
          作者简介（最多 500 字）
          <textarea
            className="sf-input mt-1 min-h-28"
            maxLength={500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>

        <button type="button" className="sf-btn-primary w-full disabled:opacity-60" disabled={saving} onClick={save}>
          {saving ? "保存中..." : "保存"}
        </button>

        {msg ? <p className="text-center text-sm text-[#5B6B8C]">{msg}</p> : null}

        <p className="text-xs text-[#5B6B8C]">
          头像存储于项目 <code className="text-[11px]">storage/users/&lt;id&gt;/avatar/</code>（
          original 与 thumb_200x200）；用户标识沿用 Cookie / OAuth 会话。
        </p>
      </div>

      <div className="sf-card mt-8 space-y-4 border-[#FFD6D6] bg-[#FFF8F8] p-5">
        <div>
          <h2 className="text-lg font-semibold text-[#8B2E2E]">危险操作（文档 2.3）</h2>
          <p className="mt-1 text-sm text-[#5B6B8C]">
            注销需二次确认：输入「确认注销」，并选择已发布内容的处理方式。成功后会话失效。
          </p>
        </div>
        <label className="block text-sm font-medium text-[#1F2A44]">
          输入确认文案
          <input
            className="sf-input mt-1"
            placeholder="确认注销"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
          />
        </label>
        <fieldset className="space-y-2 text-sm">
          <legend className="font-medium text-[#1F2A44]">作品与内容</legend>
          <label className="flex cursor-pointer gap-2">
            <input
              type="radio"
              name="works_action"
              checked={worksAction === "anonymize_published"}
              onChange={() => setWorksAction("anonymize_published")}
            />
            <span className="text-[#5B6B8C]">
              匿名保留已发布内容（前台作者显示为「已注销用户」，点赞/关注等个人侧数据清除）
            </span>
          </label>
          <label className="flex cursor-pointer gap-2">
            <input
              type="radio"
              name="works_action"
              checked={worksAction === "remove_all"}
              onChange={() => setWorksAction("remove_all")}
            />
            <span className="text-[#5B6B8C]">
              下架并删除全部故事、角色卡、世界及相关数据（不可恢复）
            </span>
          </label>
        </fieldset>
        <button
          type="button"
          className="w-full rounded-lg border border-[#E08585] bg-white px-4 py-2 text-sm font-medium text-[#8B2E2E] hover:bg-[#FFF0F0] disabled:opacity-50"
          disabled={deleteBusy}
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
          {deleteBusy ? "处理中…" : "注销账号"}
        </button>
      </div>
    </main>
  );
}
