import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

/**
 * Express middleware that validates Bearer token or X-API-Key header
 * against the configured MCP_API_KEY environment variable.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) {
    // If no API key is configured, reject all requests (fail-closed)
    res.status(500).json({ error: "Server misconfigured: no API key set" });
    return;
  }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing authentication credentials" });
    return;
  }

  if (!safeCompare(token, apiKey)) {
    res.status(403).json({ error: "Invalid authentication credentials" });
    return;
  }

  next();
}

function extractToken(req: Request): string | null {
  // Check Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers["x-api-key"];
  if (typeof apiKeyHeader === "string") {
    return apiKeyHeader;
  }

  return null;
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    // Still do a comparison to prevent timing leak on length
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
