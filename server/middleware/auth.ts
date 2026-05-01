import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { logAudit } from "../audit";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role?: string; plan?: string };
    }
  }
}

const JWT_USER_ID_CLAIM = process.env.CHAKSHI_JWT_USER_ID_CLAIM || "sub";

// In-memory JWKS cache: issuer -> { key: KeyObject, fetchedAt: number }
const jwksCache = new Map<string, { key: crypto.KeyObject; fetchedAt: number }>();
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getClaimString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" ? value : undefined;
}

function getMetadataString(source: Record<string, unknown>, metadataKey: string, field: string): string | undefined {
  const metadata = source[metadataKey];
  if (!metadata || typeof metadata !== "object") return undefined;
  const value = (metadata as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}

function decodeJwtParts(token: string): { header: Record<string, unknown>; payload: Record<string, unknown> } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return { header, payload };
  } catch {
    return null;
  }
}

async function getRS256PublicKey(issuer: string, kid?: string): Promise<crypto.KeyObject> {
  const cached = jwksCache.get(issuer);
  if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cached.key;
  }

  // Supabase JWKS URL: {issuer}/.well-known/jwks.json
  // issuer is like https://xxx.supabase.co/auth/v1
  const jwksUrl = `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`;
  console.log("[auth] Fetching JWKS from:", jwksUrl);

  const resp = await fetch(jwksUrl, { signal: AbortSignal.timeout(5000) });
  if (!resp.ok) throw new Error(`JWKS fetch failed: HTTP ${resp.status}`);

  const data = await resp.json() as { keys: Array<Record<string, string>> };
  if (!data.keys || data.keys.length === 0) throw new Error("JWKS: no keys in response");

  // Pick the key matching kid, or the first key
  const jwk = (kid ? data.keys.find((k) => k.kid === kid) : null) ?? data.keys[0];
  const key = crypto.createPublicKey({ key: jwk as unknown as crypto.JsonWebKey, format: "jwk" });

  jwksCache.set(issuer, { key, fetchedAt: Date.now() });
  console.log("[auth] JWKS public key cached for issuer:", issuer, "| kid:", jwk.kid ?? "none");
  return key;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const isDev = process.env.NODE_ENV !== "production";

  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }
  if (!token && typeof req.query.token === "string") {
    token = req.query.token;
  }

  // In development mode, allow requests without a token using a mock user
  if (!token && isDev) {
    req.user = { id: "dev-user-001", role: "advocate", plan: "trial" };
    next();
    return;
  }

  if (!token) {
    logAudit(req, { action: "jwt_verification_failure", success: false, errorCode: "MISSING_TOKEN", userId: null });
    res.status(401).json({ error: "Unauthorized: missing token" });
    return;
  }

  const parts = decodeJwtParts(token);
  if (!parts) {
    res.status(401).json({ error: "Unauthorized: malformed token" });
    return;
  }

  const { header, payload } = parts;
  const alg = (header.alg as string) || "HS256";
  const kid = header.kid as string | undefined;
  const iss = payload.iss as string | undefined;

  console.log("[auth] JWT alg:", alg, "| iss:", iss || "none", "| kid:", kid || "none");
  console.log("[auth] JWT exp:", payload.exp ? new Date((payload.exp as number) * 1000).toISOString() : "no exp");
  console.log("[auth] JWT sub:", payload.sub ? String(payload.sub).slice(0, 8) + "..." : "no sub");

  try {
    let decoded: Record<string, unknown>;

    if (alg === "RS256" || alg === "RS384" || alg === "RS512" || alg === "ES256" || alg === "ES384") {
      // Asymmetric: fetch public key from JWKS
      if (!iss) {
        console.error("[auth] RS256 token missing 'iss' claim — cannot fetch JWKS");
        res.status(401).json({ error: "Unauthorized: token missing issuer" });
        return;
      }
      const publicKey = await getRS256PublicKey(iss, kid);
      decoded = jwt.verify(token, publicKey, { algorithms: [alg as jwt.Algorithm] }) as Record<string, unknown>;
    } else {
      // Symmetric HS256 — use secret
      const secret = process.env.CHAKSHI_JWT_SECRET?.trim();
      if (!secret) {
        console.error("[auth] CHAKSHI_JWT_SECRET is not set");
        res.status(500).json({ error: "Server misconfiguration: JWT secret missing" });
        return;
      }
      console.log("[auth] HS256 secret length:", secret.length);
      decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as Record<string, unknown>;
    }

    const userId =
      (decoded[JWT_USER_ID_CLAIM] as string | undefined) ||
      (decoded.sub as string | undefined) ||
      (decoded.userId as string | undefined) ||
      (decoded.user_id as string | undefined);

    if (!userId) {
      logAudit(req, { action: "jwt_verification_failure", success: false, errorCode: "NO_USER_ID_IN_TOKEN", userId: null });
      res.status(401).json({ error: "Unauthorized: token has no userId" });
      return;
    }

    const role =
      getClaimString(decoded, "chakshi_role") ||
      getClaimString(decoded, "user_role") ||
      getMetadataString(decoded, "app_metadata", "role") ||
      getMetadataString(decoded, "user_metadata", "role") ||
      getClaimString(decoded, "role");
    const plan =
      getClaimString(decoded, "chakshi_plan") ||
      getClaimString(decoded, "plan") ||
      getMetadataString(decoded, "app_metadata", "plan") ||
      getMetadataString(decoded, "user_metadata", "plan");

    req.user = { id: userId, role, plan };
    next();
  } catch (err) {
    const errName = err instanceof Error ? err.name : "UnknownError";
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[auth] JWT verify failed — name:", errName, "| message:", errMsg);
    logAudit(req, { action: "jwt_verification_failure", success: false, errorCode: "INVALID_OR_EXPIRED_TOKEN", userId: null });
    res.status(401).json({ error: "Unauthorized: invalid or expired token" });
  }
}
