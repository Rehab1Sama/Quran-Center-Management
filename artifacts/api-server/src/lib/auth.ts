import { createHash, randomBytes } from "crypto";

export function hashPassword(password: string): string {
  const salt = "sana-quran-salt";
  return createHash("sha256").update(password + salt).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function generateToken(userId: number, role: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, role, ts: Date.now() })).toString("base64");
  const sig = createHash("sha256").update(payload + (process.env.SESSION_SECRET || "fallback-secret")).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    const [payload, sig] = token.split(".");
    const expectedSig = createHash("sha256").update(payload + (process.env.SESSION_SECRET || "fallback-secret")).digest("hex");
    if (sig !== expectedSig) return null;
    return JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}
