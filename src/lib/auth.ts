import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { NextRequest } from "next/server";

const scryptAsync = promisify(scrypt);

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[Prism] AUTH_SECRET environment variable is required in production.\n" +
        "Generate one with:  openssl rand -hex 32\n" +
        "Then set it in your .env or deployment environment."
      );
    }
    // Dev-only fallback — logged so developers notice
    console.warn("[Prism] AUTH_SECRET not set. Using insecure dev default. Set AUTH_SECRET before deploying.");
    return "prism-dev-secret-do-not-use-in-production";
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [salt, stored] = hash.split(":");
    if (!salt || !stored) return false;
    const derived = (await scryptAsync(password, salt, 64)) as Buffer;
    const storedBuf = Buffer.from(stored, "hex");
    if (derived.length !== storedBuf.length) return false;
    return timingSafeEqual(derived, storedBuf);
  } catch {
    return false;
  }
}

export interface TokenPayload {
  userId: string;
  username: string;
  role: "admin" | "user";
  tokenVersion: number;
}

export function signToken(payload: TokenPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx === -1) return null;
    const data = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    const expected = createHmac("sha256", getSecret()).update(data).digest("base64url");
    const expBuf = Buffer.from(expected, "base64url");
    const sigBuf = Buffer.from(sig, "base64url");
    if (expBuf.length !== sigBuf.length || !timingSafeEqual(expBuf, sigBuf)) return null;
    return JSON.parse(Buffer.from(data, "base64url").toString()) as TokenPayload;
  } catch {
    return null;
  }
}

export function getUserFromRequest(req: NextRequest): TokenPayload | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;

  // Verify the token version matches the DB — invalidates all sessions on password change.
  // Import lazily to avoid circular deps and Edge-runtime issues (proxy.ts never calls this).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getUserTokenVersion } = require("./db") as typeof import("./db");
    const dbVersion = getUserTokenVersion(payload.userId);
    if (dbVersion === null || payload.tokenVersion !== dbVersion) return null;
  } catch {
    // If DB is unavailable, fail closed.
    return null;
  }

  return payload;
}

export const COOKIE_NAME = "prism_auth";

export function makeCookieHeader(token: string): string {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function clearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

// API keys — format: prism_<40 hex chars>
export function generateApiKey(): string {
  return `prism_${randomBytes(20).toString("hex")}`;
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function getApiUserFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? req.headers.get("x-api-key") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  if (auth.startsWith("prism_")) return auth.trim();
  return null;
}
