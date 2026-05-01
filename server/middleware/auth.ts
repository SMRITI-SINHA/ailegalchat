import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logAudit } from "../audit";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role?: string; plan?: string };
    }
  }
}

const JWT_ALGORITHM = (process.env.CHAKSHI_JWT_ALGORITHM || "HS256") as jwt.Algorithm;
const JWT_USER_ID_CLAIM = process.env.CHAKSHI_JWT_USER_ID_CLAIM || "sub";

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

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const isDev = process.env.NODE_ENV !== "production";
  const secret = process.env.CHAKSHI_JWT_SECRET?.trim();

  if (!secret) {
    console.error("[auth] CHAKSHI_JWT_SECRET is not set");
    res.status(500).json({ error: "Server misconfiguration: JWT secret missing" });
    return;
  }

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
    logAudit(req, {
      action: "jwt_verification_failure",
      success: false,
      errorCode: "MISSING_TOKEN",
      userId: null,
    });
    res.status(401).json({ error: "Unauthorized: missing token" });
    return;
  }

  try {
    // Log token shape for debugging (never log the full token)
    const parts = token.split(".");
    if (parts.length === 3) {
      try {
        const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
        console.log("[auth] JWT header:", JSON.stringify(header));
        console.log("[auth] JWT exp:", payload.exp ? new Date(payload.exp * 1000).toISOString() : "no exp");
        console.log("[auth] JWT iss:", payload.iss || "no iss");
        console.log("[auth] JWT sub:", payload.sub ? payload.sub.slice(0, 8) + "..." : "no sub");
        console.log("[auth] secret length:", secret.length);
      } catch { /* ignore decode errors */ }
    }
    const decoded = jwt.verify(token, secret, { algorithms: [JWT_ALGORITHM] }) as Record<string, unknown>;
    const userId =
      (decoded[JWT_USER_ID_CLAIM] as string | undefined) ||
      (decoded.sub as string | undefined) ||
      (decoded.userId as string | undefined) ||
      (decoded.user_id as string | undefined);

    if (!userId) {
      logAudit(req, {
        action: "jwt_verification_failure",
        success: false,
        errorCode: "NO_USER_ID_IN_TOKEN",
        userId: null,
      });
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
    logAudit(req, {
      action: "jwt_verification_failure",
      success: false,
      errorCode: "INVALID_OR_EXPIRED_TOKEN",
      userId: null,
    });
    res.status(401).json({ error: "Unauthorized: invalid or expired token" });
  }
}
