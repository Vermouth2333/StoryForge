/** MVP：存储前去掉尖括号，降低 XSS 风险（正文仍以纯文本展示）。 */
export function sanitizePlainText(input: string, maxLen: number): string {
  const t = input.slice(0, maxLen);
  return t.replace(/[<>]/g, "").trimEnd();
}

/** 中国大陆手机号 → 脱敏存储 `138****1234` */
export function maskCnPhone(digits: string): string {
  if (!/^1[3-9]\d{9}$/.test(digits)) return "";
  return `${digits.slice(0, 3)}****${digits.slice(7)}`;
}
