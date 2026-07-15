export async function uploadWorkCover(
  endpoint: string,
  file: File,
): Promise<{ ok: boolean; coverUrl?: string; msg?: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(endpoint, { method: "POST", body: formData });
  const json = await res.json();
  if (json.code === 200) {
    return { ok: true, coverUrl: json.data?.cover_url as string | undefined };
  }
  return { ok: false, msg: (json.msg as string | undefined) ?? "封面上传失败" };
}
