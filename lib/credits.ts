import { getDb, id, nowIso } from "@/lib/db";
import {
  CREDIT_COSTS,
  SIGNUP_CREDITS,
  type CreditGrantReason,
  type CreditSpendReason,
} from "@/lib/credit-costs";

export { CREDIT_COSTS, CREDIT_PACKAGES, SIGNUP_CREDITS } from "@/lib/credit-costs";

export class InsufficientCreditsError extends Error {
  readonly need: number;
  readonly balance: number;
  constructor(need: number, balance: number) {
    super(`积分不足，需要 ${need}，当前 ${balance}`);
    this.name = "InsufficientCreditsError";
    this.need = need;
    this.balance = balance;
  }
}

export async function getCreditBalance(userId: string): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ credits: number | null }>("SELECT credits FROM users WHERE id = ?", userId);
  return Math.max(0, Number(row?.credits ?? 0));
}

async function appendLedger(args: {
  userId: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  refType?: string;
  refId?: string;
  operatorUserId?: string;
  note?: string;
}) {
  const db = await getDb();
  await db.run(
    `INSERT INTO credit_ledger
      (id, user_id, delta, balance_after, reason, ref_type, ref_id, operator_user_id, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id("crd"),
    args.userId,
    args.delta,
    args.balanceAfter,
    args.reason,
    args.refType ?? null,
    args.refId ?? null,
    args.operatorUserId ?? null,
    args.note ?? null,
    nowIso(),
  );
}

export async function grantSignupCredits(userId: string) {
  const db = await getDb();
  const existed = await db.get<{ id: string }>(
    "SELECT id FROM credit_ledger WHERE user_id = ? AND reason = 'signup' LIMIT 1",
    userId,
  );
  if (existed) return;
  let balance = await getCreditBalance(userId);
  if (balance < SIGNUP_CREDITS) {
    await db.run("UPDATE users SET credits = ? WHERE id = ?", SIGNUP_CREDITS, userId);
    balance = SIGNUP_CREDITS;
  }
  await appendLedger({
    userId,
    delta: SIGNUP_CREDITS,
    balanceAfter: balance,
    reason: "signup",
    note: "新用户初始积分",
  });
}

export async function spendCredits(args: {
  userId: string;
  reason: CreditSpendReason;
  refType?: string;
  refId?: string;
}): Promise<number> {
  const cost = CREDIT_COSTS[args.reason];
  const db = await getDb();
  const row = await db.get<{ credits: number | null }>("SELECT credits FROM users WHERE id = ?", args.userId);
  const balance = Math.max(0, Number(row?.credits ?? 0));
  if (balance < cost) {
    throw new InsufficientCreditsError(cost, balance);
  }
  const next = balance - cost;
  await db.run("UPDATE users SET credits = ? WHERE id = ?", next, args.userId);
  await appendLedger({
    userId: args.userId,
    delta: -cost,
    balanceAfter: next,
    reason: args.reason,
    refType: args.refType,
    refId: args.refId,
  });
  return next;
}

export async function refundCredits(args: {
  userId: string;
  reason: CreditGrantReason;
  amount: number;
  refType?: string;
  refId?: string;
  note?: string;
}): Promise<number> {
  if (args.amount <= 0) return getCreditBalance(args.userId);
  const db = await getDb();
  if (args.refId) {
    const existed = await db.get<{ id: string }>(
      "SELECT id FROM credit_ledger WHERE user_id = ? AND reason = ? AND ref_id = ? LIMIT 1",
      args.userId,
      args.reason,
      args.refId,
    );
    if (existed) return getCreditBalance(args.userId);
  }
  const row = await db.get<{ credits: number | null }>("SELECT credits FROM users WHERE id = ?", args.userId);
  const balance = Math.max(0, Number(row?.credits ?? 0));
  const next = balance + args.amount;
  await db.run("UPDATE users SET credits = ? WHERE id = ?", next, args.userId);
  await appendLedger({
    userId: args.userId,
    delta: args.amount,
    balanceAfter: next,
    reason: args.reason,
    refType: args.refType,
    refId: args.refId,
    note: args.note,
  });
  return next;
}

export async function grantCredits(args: {
  targetUserId: string;
  amount: number;
  operatorUserId: string;
  note?: string;
}): Promise<number> {
  if (!Number.isInteger(args.amount) || args.amount <= 0 || args.amount > 1_000_000) {
    throw new Error("发放数量须为 1～1000000 的整数");
  }
  const db = await getDb();
  const row = await db.get<{ credits: number | null }>(
    "SELECT credits FROM users WHERE id = ?",
    args.targetUserId,
  );
  if (!row) throw new Error("用户不存在");
  const balance = Math.max(0, Number(row.credits ?? 0));
  const next = balance + args.amount;
  await db.run("UPDATE users SET credits = ? WHERE id = ?", next, args.targetUserId);
  await appendLedger({
    userId: args.targetUserId,
    delta: args.amount,
    balanceAfter: next,
    reason: "grant",
    operatorUserId: args.operatorUserId,
    note: args.note,
  });
  return next;
}
