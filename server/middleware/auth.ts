import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

const JWT_ALGORITHM = (process.env.CHAKSHI_JWT_ALGORITHM || "HS256") as jwt.Algorithm;
const JWT_USER_ID_CLAIM = process.env.CHAKSHI_JWT_USER_ID_CLAIM || "sub";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.CHAKSHI_JWT_SECRET;

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

  if (!token) {
    res.status(401).json({ error: "Unauthorized: missing token" });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret, { algorithms: [JWT_ALGORITHM] }) as Record<string, unknown>;
    const userId =
      (decoded[JWT_USER_ID_CLAIM] as string | undefined) ||
      (decoded.sub as string | undefined) ||
      (decoded.userId as string | undefined) ||
      (decoded.user_id as string | undefined);

    if (!userId) {
      res.status(401).json({ error: "Unauthorized: token has no userId" });
      return;
    }

    req.user = { id: userId };
    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized: invalid or expired token" });
  }
}
