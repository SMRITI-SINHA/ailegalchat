import type { Request } from "express";
import { db } from "./db";
import { auditLogs } from "@shared/schema";

export interface AuditDetails {
  action: string;
  resourceType?: string;
  resourceId?: string;
  userId?: string | null;
  success?: boolean;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first.trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export function logAudit(req: Request, details: AuditDetails): void {
  const ip = getClientIp(req);
  const userId = details.userId !== undefined ? details.userId : (req.user?.id ?? null);

  db.insert(auditLogs).values({
    userId,
    action: details.action,
    resourceType: details.resourceType ?? null,
    resourceId: details.resourceId ?? null,
    ipAddress: ip,
    success: details.success ?? true,
    errorCode: details.errorCode ?? null,
    metadata: details.metadata ?? null,
  }).catch(() => {
  });
}
