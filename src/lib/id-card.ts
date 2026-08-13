import { createHmac, timingSafeEqual } from "node:crypto";
import type { Role } from "@/lib/auth";

export type IdCardTokenPayload = {
  tenantId: string;
  source: "user" | "student" | "resource";
  recordId: number;
  cardId: string;
  name: string;
  role: Role;
  exp: number;
};

function secret() {
  if (process.env.NODE_ENV === "production" && !process.env.ID_CARD_SECRET && !process.env.AUTH_SECRET) {
    throw new Error("ID_CARD_SECRET or AUTH_SECRET is required in production");
  }
  return process.env.ID_CARD_SECRET || process.env.AUTH_SECRET || "development-only-id-card-secret";
}

function signature(value: string) {
  return createHmac("sha256", secret()).update(`id-card:v1:${value}`).digest("base64url");
}

export function createIdCardToken(payload: IdCardTokenPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifyIdCardToken(token: string): IdCardTokenPayload | null {
  if (token.length > 2048) return null;
  const [encoded, supplied] = token.split(".");
  if (!encoded || !supplied) return null;
  const expected = signature(encoded);
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as Partial<IdCardTokenPayload>;
    if (!payload.tenantId || !payload.source || !Number.isInteger(payload.recordId) || !payload.cardId || !payload.name || !payload.role || !payload.exp) return null;
    if (!["user", "student", "resource"].includes(payload.source) || !["superadmin", "admin", "teacher", "student", "parent"].includes(payload.role) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload as IdCardTokenPayload;
  } catch {
    return null;
  }
}

export function currentAcademicYear(date = new Date()) {
  const start = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return { label: `${start}–${start + 1}`, validUntil: new Date(Date.UTC(start + 1, 5, 30, 23, 59, 59)) };
}
