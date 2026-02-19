import { Request } from "express";

// ─── Extract real client IP ───────────────────────────────────────────────────
// Works behind nginx / any proxy that sets X-Forwarded-For.

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "";
}

// ─── Check if IP is private / loopback ───────────────────────────────────────

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1"        ||
    ip === "::ffff:127.0.0.1" ||
    ip.startsWith("10.")    ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

// ─── Geo-lookup via ip-api.com (free, no API key, 45 req/min) ────────────────
// Returns empty string on failure — NEVER blocks registration.

export async function getCountryFromIp(ip: string): Promise<string> {
  if (!ip || isPrivateIp(ip)) return "";

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return "";
    const data = await res.json() as { status: string; country?: string };
    return data.status === "success" ? (data.country ?? "") : "";
  } catch {
    return ""; // timeout, network error, etc. — silently skip
  }
}