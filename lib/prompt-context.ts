import type { Database } from "sqlite";
import type { ChatMessage } from "./ai-provider";
import { RagEngine } from "./rag-engine";

/**
 * 分层 Prompt 组装（见 docs/StoryForge_技术文档.md 5.3.1）：
 * 系统层（硬约束）/ 项目层（世界观）/ 角色层 / 文风层 / 历史对话 / 用户即时指令。
 *
 * 仅注入显性设定与最近若干轮对话，控制 token 成本。
 */

const SYSTEM_PROMPT = [
  "你是 StoryForge 的 AI 小说创作助手，需遵守以下规则：",
  "1) 输出内容符合中国法律法规，禁止涉政/涉黄/涉暴等违规内容；",
  "2) 角色发言需符合其人设，禁止明显 OOC；",
  "3) 世界观需遵循用户设定，禁止自相矛盾；",
  "4) 以中文进行富有画面感的小说化叙述。",
].join("\n");

const MAX_HISTORY_MESSAGES = 12;
/** 单次注入的 RAG 检索条目上限，控制 token 成本 */
const MAX_RAG_ENTRIES = 3;

interface SessionContextRow {
  session_type: string;
  story_id: string | null;
  character_id: string | null;
  world_id: string | null;
}

/**
 * 将查询切分为可供关键词检索匹配的词元：
 * 英文/数字按词，中文按 bi-gram，以适配 RagEngine 的空白分词。
 */
function tokenizeForRag(text: string): string {
  const tokens: string[] = [];
  const words = text.match(/[a-zA-Z0-9]+/g);
  if (words) tokens.push(...words.map((w) => w.toLowerCase()));
  const chinese = text.replace(/[^\u4e00-\u9fa5]+/g, "");
  for (let i = 0; i < chinese.length - 1; i += 1) {
    tokens.push(chinese.slice(i, i + 2));
  }
  return tokens.join(" ");
}

/**
 * 基于世界知识条目做轻量 RAG 检索（关键词匹配），按相关度返回若干片段。
 * 使用独立的内存向量库实例，先清空再索引，避免跨会话污染。
 */
async function retrieveWorldKnowledge(
  db: Database,
  worldId: string,
  query: string,
): Promise<string[]> {
  const entries = await db.all<Array<{ id: string; title: string; body: string }>>(
    "SELECT id, title, body FROM knowledge_entries WHERE world_id = ? ORDER BY sort_order, id LIMIT 200",
    worldId,
  );
  if (entries.length === 0) return [];

  const tokenized = tokenizeForRag(query);
  if (!tokenized) return [];

  const rag = new RagEngine();
  rag.clear();
  for (const e of entries) {
    rag.indexKnowledgeEntry({
      id: e.id,
      name: e.title,
      content: e.body,
      world_id: worldId,
    });
  }

  return rag
    .retrieve(tokenized, { types: ["knowledge"], limit: MAX_RAG_ENTRIES })
    .map((r) => r.content);
}

export async function buildChatContext(
  db: Database,
  sessionId: string,
  session: SessionContextRow,
  userContent: string,
): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  if (session.world_id) {
    const world = await db.get<{ name: string; summary: string; setting_notes: string }>(
      "SELECT name, summary, setting_notes FROM worlds WHERE id = ?",
      session.world_id,
    );
    if (world) {
      messages.push({
        role: "system",
        content: [
          `# 世界观设定`,
          `世界名称：${world.name}`,
          world.summary ? `简介：${world.summary}` : "",
          world.setting_notes ? `设定要点：${world.setting_notes}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }
  }

  if (session.character_id) {
    const character = await db.get<{ name: string; summary: string; personality: string }>(
      "SELECT name, summary, personality FROM characters WHERE id = ?",
      session.character_id,
    );
    if (character) {
      messages.push({
        role: "system",
        content: [
          `# 角色设定`,
          `角色名称：${character.name}`,
          character.summary ? `简介：${character.summary}` : "",
          character.personality ? `性格与说话风格：${character.personality}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }
  }

  if (session.story_id) {
    const anchor = await db
      .get<{ features_json: string }>(
        "SELECT features_json FROM story_style_anchors WHERE story_id = ? ORDER BY updated_at DESC LIMIT 1",
        session.story_id,
      )
      .catch(() => undefined);
    if (anchor?.features_json) {
      messages.push({
        role: "system",
        content: `# 文风约束（style_constraints）\n请保持以下文风特征：${anchor.features_json}`,
      });
    }
  }

  // RAG 检索：按当前指令从世界知识库召回相关设定，注入参考资料层
  if (session.world_id) {
    try {
      const snippets = await retrieveWorldKnowledge(db, session.world_id, userContent);
      if (snippets.length > 0) {
        messages.push({
          role: "system",
          content:
            "# 参考资料（按相关度检索的世界设定条目）\n" +
            snippets.map((s, i) => `${i + 1}. ${s}`).join("\n") +
            "\n请在创作时参考以上资料，保持与设定一致，不要凭空杜撰与之冲突的内容。",
        });
      }
    } catch {
      // RAG 检索失败不影响主流程
    }
  }

  const history = await db.all<{ role: string; content: string }[]>(
    `SELECT role, content FROM chat_messages
     WHERE session_id = ? AND role IN ('user','assistant')
     ORDER BY datetime(created_at) DESC, rowid DESC
     LIMIT ?`,
    sessionId,
    MAX_HISTORY_MESSAGES,
  );
  history.reverse();
  for (const h of history) {
    messages.push({
      role: h.role === "assistant" ? "assistant" : "user",
      content: h.content,
    });
  }

  messages.push({ role: "user", content: userContent });
  return messages;
}
