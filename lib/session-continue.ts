/** 根据会话类型生成继续对话的页面路径 */
export function getContinueSessionHref(session: {
  id: string;
  session_type: string;
  story_id?: string | null;
  character_id?: string | null;
  world_id?: string | null;
}): string | null {
  const q = `session=${encodeURIComponent(session.id)}`;
  switch (session.session_type) {
    case "character":
      return session.character_id
        ? `/characters/${session.character_id}/chat?${q}`
        : null;
    case "world":
    case "explore":
      return session.world_id ? `/worlds/${session.world_id}/chat?${q}` : null;
    case "story":
      return session.story_id ? `/stories/${session.story_id}/play?${q}` : null;
    default:
      return null;
  }
}
