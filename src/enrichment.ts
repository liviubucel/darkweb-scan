import type { Env } from "./types";
import { HttpError } from "./security";

function isIpLiteral(hostname: string): boolean { return /^[0-9.]+$/.test(hostname) || hostname.includes(":"); }
function hostnameAllowed(hostname: string, configured: string): boolean {
  const host = hostname.toLowerCase();
  return configured.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean).some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}
export function validateClearWebUrl(raw: unknown, env: Env): string {
  if (typeof raw !== "string" || raw.length > 2048) throw new HttpError(400, "Invalid URL");
  let url: URL; try { url = new URL(raw); } catch { throw new HttpError(400, "Invalid URL"); }
  if (url.protocol !== "https:" || url.username || url.password) throw new HttpError(400, "Only HTTPS URLs are allowed");
  if (isIpLiteral(url.hostname) || url.hostname === "localhost" || url.hostname.endsWith(".local")) throw new HttpError(400, "Host is not allowed");
  if (!hostnameAllowed(url.hostname, env.ALLOWED_BROWSER_HOSTS)) throw new HttpError(403, "Host is not allowlisted");
  return url.toString();
}
export async function browserMarkdown(env: Env, target: string): Promise<string> {
  const response = await env.BROWSER.quickAction("markdown", { url: target, gotoOptions: { timeout: 20_000, waitUntil: "domcontentloaded" } });
  const text = await response.text();
  if (!response.ok) throw new HttpError(502, "Browser enrichment failed");
  return text.slice(0, 80_000);
}
