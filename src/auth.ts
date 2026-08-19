import type { AuthContext, Env } from "./types";
import { HttpError } from "./security";

interface JwtHeader { alg?: string; kid?: string; typ?: string }
interface ClerkV2Organization { id?: string; rol?: string; per?: string; slg?: string }
interface JwtClaims {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  azp?: string;
  exp?: number;
  nbf?: number;
  sid?: string;
  v?: number;
  o?: ClerkV2Organization;
  org_id?: string;
  org_role?: string;
}
interface Jwk extends JsonWebKey { kid?: string }
interface Jwks { keys: Jwk[] }

function configured(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized.startsWith("REPLACE_")) return undefined;
  return normalized;
}

function authConfig(env: Env): { issuer: string; jwksUrl: string; audience: string; authorizedParties: string } {
  const issuer = configured(env.CLERK_ISSUER);
  const jwksUrl = configured(env.CLERK_JWKS_URL);
  if (!issuer || !jwksUrl) throw new HttpError(503, "Authentication is not configured");
  return {
    issuer,
    jwksUrl,
    audience: configured(env.CLERK_AUDIENCE) ?? "",
    authorizedParties: configured(env.CLERK_AUTHORIZED_PARTIES) ?? "",
  };
}

function decodeBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function decodeJson<T>(input: string): T { return JSON.parse(new TextDecoder().decode(decodeBase64Url(input))) as T; }
function audienceMatches(actual: string | string[] | undefined, expected: string): boolean {
  if (!expected) return true;
  if (typeof actual === "string") return actual === expected;
  return Array.isArray(actual) && actual.includes(expected);
}
function authorizedPartyMatches(actual: string | undefined, configuredParties: string): boolean {
  const allowed = configuredParties.split(",").map((value) => value.trim()).filter(Boolean);
  if (!allowed.length) return true;
  return typeof actual === "string" && allowed.includes(actual);
}
function normalizeOrgRole(role: string | undefined): string | undefined {
  if (!role) return undefined;
  return role.startsWith("org:") ? role : `org:${role}`;
}
function readSessionToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Bearer ")) {
    const bearer = authorization.slice(7).trim();
    if (bearer) return bearer;
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    if (name !== "__session") continue;
    const raw = part.slice(separator + 1).trim();
    if (!raw) break;
    try { return decodeURIComponent(raw); } catch { return raw; }
  }
  throw new HttpError(401, "Authentication required");
}
async function loadJwks(env: Env, jwksUrl: string): Promise<Jwks> {
  const cacheKey = `clerk:jwks:v2:${jwksUrl}`;
  const cached = await env.CACHE.get(cacheKey, "json");
  if (cached && typeof cached === "object" && "keys" in cached) return cached as Jwks;
  let url: URL;
  try { url = new URL(jwksUrl); } catch { throw new HttpError(500, "Invalid authentication configuration"); }
  if (url.protocol !== "https:") throw new HttpError(500, "Invalid authentication configuration");
  const response = await fetch(url, { headers: { accept: "application/json" }, cf: { cacheTtl: 300, cacheEverything: true } });
  if (!response.ok) throw new HttpError(503, "Authentication keys unavailable");
  const jwks = (await response.json()) as Jwks;
  if (!Array.isArray(jwks.keys)) throw new HttpError(503, "Invalid authentication keys");
  await env.CACHE.put(cacheKey, JSON.stringify(jwks), { expirationTtl: 300 });
  return jwks;
}

export function isAuthenticationConfigured(env: Env): boolean {
  return Boolean(configured(env.CLERK_ISSUER) && configured(env.CLERK_JWKS_URL));
}

export async function authenticate(request: Request, env: Env): Promise<AuthContext> {
  const config = authConfig(env);
  const token = readSessionToken(request);
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError(401, "Invalid token");
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  if (!encodedHeader || !encodedClaims || !encodedSignature) throw new HttpError(401, "Invalid token");
  let header: JwtHeader; let claims: JwtClaims;
  try { header = decodeJson<JwtHeader>(encodedHeader); claims = decodeJson<JwtClaims>(encodedClaims); }
  catch { throw new HttpError(401, "Invalid token"); }
  if (header.alg !== "RS256" || !header.kid) throw new HttpError(401, "Unsupported token");
  const jwks = await loadJwks(env, config.jwksUrl);
  const jwk = jwks.keys.find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA");
  if (!jwk) throw new HttpError(401, "Unknown signing key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const signed = new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`);
  const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeBase64Url(encodedSignature), signed);
  if (!verified) throw new HttpError(401, "Invalid signature");

  const now = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp <= now - 30) throw new HttpError(401, "Expired token");
  if (claims.nbf && claims.nbf > now + 30) throw new HttpError(401, "Token not active");
  if (claims.iss !== config.issuer) throw new HttpError(401, "Invalid issuer");
  if (!audienceMatches(claims.aud, config.audience)) throw new HttpError(401, "Invalid audience");
  if (!authorizedPartyMatches(claims.azp, config.authorizedParties)) throw new HttpError(401, "Invalid authorized party");
  if (!claims.sub) throw new HttpError(401, "Missing subject");

  const organizationId = claims.o?.id ?? claims.org_id;
  const organizationRole = normalizeOrgRole(claims.o?.rol ?? claims.org_role);
  return {
    userId: claims.sub,
    orgId: organizationId ?? `personal:${claims.sub}`,
    ...(organizationRole ? { orgRole: organizationRole } : {}),
    ...(claims.sid ? { sessionId: claims.sid } : {}),
  };
}
