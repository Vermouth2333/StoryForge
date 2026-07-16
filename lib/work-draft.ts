import type { Database } from "sqlite";

export type WorkTable = "characters" | "worlds" | "stories";

export function parseDraftJson(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
}

export function tagsToJson(tags: unknown): string {
  return JSON.stringify(Array.isArray(tags) ? tags : []);
}

export function resolveCharacterEditorValues(row: {
  name: string;
  summary: string;
  personality: string;
  tags_json: string;
  draft_json?: string | null;
}) {
  const draft = parseDraftJson(row.draft_json);
  if (!draft) {
    return {
      name: row.name,
      summary: row.summary,
      personality: row.personality,
      tagsJson: row.tags_json,
    };
  }
  return {
    name: typeof draft.name === "string" ? draft.name : row.name,
    summary: typeof draft.summary === "string" ? draft.summary : row.summary,
    personality: typeof draft.personality === "string" ? draft.personality : row.personality,
    tagsJson: Array.isArray(draft.tags) ? tagsToJson(draft.tags) : row.tags_json,
  };
}

export function resolveWorldEditorValues(row: {
  name: string;
  summary: string;
  setting_notes: string;
  tags_json: string;
  draft_json?: string | null;
}) {
  const draft = parseDraftJson(row.draft_json);
  if (!draft) {
    return {
      name: row.name,
      summary: row.summary,
      settingNotes: row.setting_notes,
      tagsJson: row.tags_json,
    };
  }
  return {
    name: typeof draft.name === "string" ? draft.name : row.name,
    summary: typeof draft.summary === "string" ? draft.summary : row.summary,
    settingNotes:
      typeof draft.setting_notes === "string" ? draft.setting_notes : row.setting_notes,
    tagsJson: Array.isArray(draft.tags) ? tagsToJson(draft.tags) : row.tags_json,
  };
}

export function resolveStoryEditorValues(row: {
  title: string;
  summary: string;
  tags_json: string;
  draft_json?: string | null;
}) {
  const draft = parseDraftJson(row.draft_json);
  if (!draft) {
    return {
      name: row.title,
      summary: row.summary,
      tagsJson: row.tags_json,
    };
  }
  return {
    name: typeof draft.title === "string" ? draft.title : row.title,
    summary: typeof draft.summary === "string" ? draft.summary : row.summary,
    tagsJson: Array.isArray(draft.tags) ? tagsToJson(draft.tags) : row.tags_json,
  };
}

type CharacterPatch = {
  name?: string;
  summary?: string;
  personality?: string;
  tags?: string[];
};

type WorldPatch = {
  name?: string;
  summary?: string;
  setting_notes?: string;
  tags?: string[];
};

type StoryPatch = {
  title?: string;
  summary?: string;
  tags?: string[];
};

export async function patchCharacterWork(
  db: Database,
  id: string,
  status: string,
  syncToMarket: boolean,
  patch: CharacterPatch,
  now: string,
): Promise<{ syncedToMarket: boolean }> {
  if (status === "published" && !syncToMarket) {
    const row = await db.get<{ draft_json: string | null }>(
      "SELECT draft_json FROM characters WHERE id = ?",
      id,
    );
    const merged = { ...(parseDraftJson(row?.draft_json) ?? {}), ...patch };
    await db.run("UPDATE characters SET draft_json = ?, updated_at = ? WHERE id = ?", JSON.stringify(merged), now, id);
    return { syncedToMarket: false };
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.summary !== undefined) {
    fields.push("summary = ?");
    values.push(patch.summary);
  }
  if (patch.personality !== undefined) {
    fields.push("personality = ?");
    values.push(patch.personality);
  }
  if (patch.tags !== undefined) {
    fields.push("tags_json = ?");
    values.push(JSON.stringify(patch.tags));
  }
  if (status === "published" && syncToMarket) {
    fields.push("draft_json = NULL");
  }
  fields.push("updated_at = ?");
  values.push(now, id);
  await db.run(`UPDATE characters SET ${fields.join(", ")} WHERE id = ?`, ...values);
  return { syncedToMarket: status === "published" && syncToMarket };
}

export async function patchWorldWork(
  db: Database,
  id: string,
  status: string,
  syncToMarket: boolean,
  patch: WorldPatch,
  now: string,
): Promise<{ syncedToMarket: boolean }> {
  if (status === "published" && !syncToMarket) {
    const row = await db.get<{ draft_json: string | null }>(
      "SELECT draft_json FROM worlds WHERE id = ?",
      id,
    );
    const merged = { ...(parseDraftJson(row?.draft_json) ?? {}), ...patch };
    await db.run("UPDATE worlds SET draft_json = ?, updated_at = ? WHERE id = ?", JSON.stringify(merged), now, id);
    return { syncedToMarket: false };
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.summary !== undefined) {
    fields.push("summary = ?");
    values.push(patch.summary);
  }
  if (patch.setting_notes !== undefined) {
    fields.push("setting_notes = ?");
    values.push(patch.setting_notes);
  }
  if (patch.tags !== undefined) {
    fields.push("tags_json = ?");
    values.push(JSON.stringify(patch.tags));
  }
  if (status === "published" && syncToMarket) {
    fields.push("draft_json = NULL");
  }
  fields.push("updated_at = ?");
  values.push(now, id);
  await db.run(`UPDATE worlds SET ${fields.join(", ")} WHERE id = ?`, ...values);
  return { syncedToMarket: status === "published" && syncToMarket };
}

export async function patchStoryWork(
  db: Database,
  id: string,
  status: string,
  syncToMarket: boolean,
  patch: StoryPatch,
  now: string,
): Promise<{ syncedToMarket: boolean }> {
  if (status === "published" && !syncToMarket) {
    const row = await db.get<{ draft_json: string | null }>(
      "SELECT draft_json FROM stories WHERE id = ?",
      id,
    );
    const merged = { ...(parseDraftJson(row?.draft_json) ?? {}), ...patch };
    await db.run("UPDATE stories SET draft_json = ?, updated_at = ? WHERE id = ?", JSON.stringify(merged), now, id);
    return { syncedToMarket: false };
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.title !== undefined) {
    fields.push("title = ?");
    values.push(patch.title);
  }
  if (patch.summary !== undefined) {
    fields.push("summary = ?");
    values.push(patch.summary);
  }
  if (patch.tags !== undefined) {
    fields.push("tags_json = ?");
    values.push(JSON.stringify(patch.tags));
  }
  if (status === "published" && syncToMarket) {
    fields.push("draft_json = NULL");
  }
  fields.push("updated_at = ?");
  values.push(now, id);
  await db.run(`UPDATE stories SET ${fields.join(", ")} WHERE id = ?`, ...values);
  return { syncedToMarket: status === "published" && syncToMarket };
}

export async function applyCharacterDraftToMarket(db: Database, id: string, now: string) {
  const row = await db.get<{
    draft_json: string | null;
    name: string;
    summary: string;
    personality: string;
    tags_json: string;
  }>("SELECT draft_json, name, summary, personality, tags_json FROM characters WHERE id = ?", id);
  if (!row?.draft_json) return;
  const draft = parseDraftJson(row.draft_json);
  if (!draft) return;
  await db.run(
    `UPDATE characters SET
      name = ?, summary = ?, personality = ?, tags_json = ?, draft_json = NULL, updated_at = ?
     WHERE id = ?`,
    typeof draft.name === "string" ? draft.name : row.name,
    typeof draft.summary === "string" ? draft.summary : row.summary,
    typeof draft.personality === "string" ? draft.personality : row.personality,
    Array.isArray(draft.tags) ? JSON.stringify(draft.tags) : row.tags_json,
    now,
    id,
  );
}

export async function applyWorldDraftToMarket(db: Database, id: string, now: string) {
  const row = await db.get<{
    draft_json: string | null;
    name: string;
    summary: string;
    setting_notes: string;
    tags_json: string;
  }>("SELECT draft_json, name, summary, setting_notes, tags_json FROM worlds WHERE id = ?", id);
  if (!row?.draft_json) return;
  const draft = parseDraftJson(row.draft_json);
  if (!draft) return;
  await db.run(
    `UPDATE worlds SET
      name = ?, summary = ?, setting_notes = ?, tags_json = ?, draft_json = NULL, updated_at = ?
     WHERE id = ?`,
    typeof draft.name === "string" ? draft.name : row.name,
    typeof draft.summary === "string" ? draft.summary : row.summary,
    typeof draft.setting_notes === "string" ? draft.setting_notes : row.setting_notes,
    Array.isArray(draft.tags) ? JSON.stringify(draft.tags) : row.tags_json,
    now,
    id,
  );
}

export async function applyStoryDraftToMarket(db: Database, id: string, now: string) {
  const row = await db.get<{
    draft_json: string | null;
    title: string;
    summary: string;
    tags_json: string;
  }>("SELECT draft_json, title, summary, tags_json FROM stories WHERE id = ?", id);
  if (!row?.draft_json) return;
  const draft = parseDraftJson(row.draft_json);
  if (!draft) return;
  await db.run(
    `UPDATE stories SET
      title = ?, summary = ?, tags_json = ?, draft_json = NULL, updated_at = ?
     WHERE id = ?`,
    typeof draft.title === "string" ? draft.title : row.title,
    typeof draft.summary === "string" ? draft.summary : row.summary,
    Array.isArray(draft.tags) ? JSON.stringify(draft.tags) : row.tags_json,
    now,
    id,
  );
}
