import type { ChatMessageItem } from "@/components/ChatWorkspace";

export type ChatSseAffinity = { score: number; label: string };

type ChatSsePayload = {
  type?: string;
  content?: string;
  affinity?: ChatSseAffinity | null;
  message_id?: string;
  incomplete?: boolean;
  reason?: string;
  msg?: string;
};

export async function readChatSse(
  res: Response,
  onContent: (full: string) => void,
): Promise<{
  text: string;
  affinity?: ChatSseAffinity | null;
  messageId?: string;
  incomplete?: boolean;
}> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("text/event-stream")) {
    let msg = "生成失败";
    try {
      const json = (await res.json()) as { msg?: string };
      if (json?.msg) msg = json.msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  if (!res.body) {
    throw new Error("生成失败");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let acc = "";
  let affinity: ChatSseAffinity | null | undefined;
  let messageId: string | undefined;
  let incomplete = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const ev of events) {
      const line = ev.trim();
      if (!line.startsWith("data:")) continue;
      try {
        const payload = JSON.parse(line.slice(5).trim()) as ChatSsePayload;
        if (payload.type === "content" && payload.content) {
          acc += payload.content;
          onContent(acc);
        } else if (payload.type === "done") {
          if (payload.affinity) affinity = payload.affinity;
          if (payload.message_id) messageId = payload.message_id;
          if (payload.incomplete) incomplete = true;
        } else if (payload.type === "error") {
          throw new Error(payload.msg || "生成失败");
        }
      } catch (err) {
        if (err instanceof SyntaxError) continue;
        throw err;
      }
    }
  }

  return { text: acc, affinity, messageId, incomplete };
}

export function findLastAssistant(messages: ChatMessageItem[]): ChatMessageItem | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant") return m;
    if (m.role === "user") return null;
  }
  return null;
}

export function requestChatStop(
  sessionId: string,
  abort: AbortController | null,
) {
  if (sessionId) {
    void fetch(`/api/chat/sessions/${sessionId}/stop`, { method: "POST" });
  }
  abort?.abort();
}

export async function regenerateLastReply(args: {
  sessionId: string;
  last: ChatMessageItem;
  setMessages: (updater: (prev: ChatMessageItem[]) => ChatMessageItem[]) => void;
  setStreamText: (value: string) => void;
  setBusy: (value: boolean) => void;
  abortRef: { current: AbortController | null };
  onAffinity?: (affinity: ChatSseAffinity) => void;
}): Promise<void> {
  const { sessionId, last, setMessages, setStreamText, setBusy, abortRef, onAffinity } =
    args;
  setBusy(true);
  setStreamText("");
  setMessages((prev) => prev.filter((m) => m.id !== last.id));

  const controller = new AbortController();
  abortRef.current = controller;

  const restore = () => {
    setStreamText("");
    setMessages((prev) => (prev.some((m) => m.id === last.id) ? prev : [...prev, last]));
  };

  try {
    const res = await fetch(`/api/chat/sessions/${sessionId}/regenerate`, {
      method: "POST",
      signal: controller.signal,
    });
    const { text, affinity, incomplete } = await readChatSse(res, setStreamText);
    if (affinity && onAffinity) onAffinity(affinity);
    if (incomplete || !text) {
      restore();
      return;
    }
    setMessages((prev) => [...prev, { ...last, content: text }]);
    setStreamText("");
  } catch {
    restore();
  } finally {
    abortRef.current = null;
    setBusy(false);
  }
}
