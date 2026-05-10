"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";

export default function WorldExplorePage() {
  const params = useParams();
  const router = useRouter();
  const worldId = params.id as string;

  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const startExplore = async () => {
    if (!input.trim()) return;

    setLoading(true);
    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);

    try {
      if (!sessionId) {
        const res = await fetch("/api/chat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_type: "explore",
            world_id: worldId,
            title: `世界探索 - ${new Date().toLocaleDateString()}`,
          }),
        });
        const data = await res.json();
        if (data.code === 200) {
          setSessionId(data.data.session_id);
        }
      }

      const generateRes = await fetch(`/api/chat/sessions/${sessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input }),
      });

      if (generateRes.ok) {
        const reader = generateRes.body?.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === "content") {
                    assistantMessage += data.content;
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      if (newMessages[newMessages.length - 1].role === "assistant") {
                        newMessages[newMessages.length - 1].content = assistantMessage;
                      } else {
                        newMessages.push({ role: "assistant", content: assistantMessage });
                      }
                      return newMessages;
                    });
                  }
                } catch {}
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Explore error:", error);
    } finally {
      setLoading(false);
      setInput("");
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-blue-500 hover:text-blue-600 mb-4"
          >
            ← 返回
          </button>
          <h1 className="text-2xl font-bold text-gray-900">世界探索模式</h1>
          <p className="text-gray-600 mt-2">
            在这里你可以探索世界的任何细节，询问关于世界观、地理、历史、组织等问题。
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="h-96 overflow-y-auto mb-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-12">
                <p>开始你的世界探索之旅吧！</p>
                <p className="text-sm mt-2">可以询问关于这个世界的任何问题</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <span className="animate-pulse">AI 正在思考...</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && startExplore()}
              placeholder="输入你的问题..."
              disabled={loading}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={startExplore}
              disabled={loading || !input.trim()}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "探索中..." : "探索"}
            </button>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">探索提示</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 询问这个世界的基本设定和规则</li>
            <li>• 探索地理环境、城市、地点</li>
            <li>• 了解历史大事件和传说</li>
            <li>• 探索组织、势力、种族</li>
            <li>• 询问物品、魔法、科技</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
