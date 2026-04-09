const stopMap = new Map<string, boolean>();

export function requestStop(sessionId: string) {
  stopMap.set(sessionId, true);
}

export function consumeStop(sessionId: string) {
  const flag = stopMap.get(sessionId) ?? false;
  if (flag) stopMap.delete(sessionId);
  return flag;
}
