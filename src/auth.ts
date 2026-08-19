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
function authorizedPartyMatches(actual: string | undefined, configured: string): boolean {
  const allowed = configured.split(",").map((value) => value.trim()).filter(Boolean);
  if (!allowed.length) return true;
  return typeof actual === "string" && allowed.includes(actual);
}
function normalizeOrgRole(role: string | undefined): string | undefined {
  if (!role) return undefined;
  return role.startsWith("org:") ? role : `org:${role}`;
}
async function loadJwks(env: Env): Promise<Jwks> {
  const cacheKey = "clerk:jwks:v2";
  const cached = await env.CACHE.get(cacheKey, "json");
  if (cached && typeof cached === "object" && "keys" in cached) return cached as Jwks;
  const url = new URL(env.CLERK_JWKS_URL);
  if (url.protocol !== "https:") throw new HttpError(500, "Invalid authentication configuration");
  const response = await fetch(url, { headers: { accept: "application/json" }, cf: { cacheTtl: 300, cacheEverything: true } });
  if (!response.ok) throw new HttpError(503, "Authentication keys unavailable");
  const jwks = (await response.json()) as Jwks;
  if (!Array.isArray(jwks.keys)) throw new HttpError(503, "Invalid authentication keys");
  await env.CACHE.put(cacheKey, JSON.stringify(jwks), { expirationTtl: 300 });
  return jwks;
}

export async function authenticate(request: Request, env: Env): Promise<AuthContext> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new HttpError(401, "Authentication required");
  const token = authorization.slice(7).trim();
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError(401, "Invalid token");
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  if (!encodedHeader || !encodedClaims || !encodedSignature) throw new HttpError(401, "Invalid token");
  let header: JwtHeader; let claims: JwtClaims;
  try { header = decodeJson<JwtHeader>(encodedHeader); claims = decodeJson<JwtClaims>(encodedClaims); }
  catch { throw new HttpError(401, "Invalid token"); }
  if (header.alg !== "RS256" || !header.kid) throw new HttpError(401, "Unsupported token");
  const jwks = await loadJwks(env);
  const jwk = jwks.keys.find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA");
  if (!jwk) throw new HttpError(401, "Unknown signing key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const signed = new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`);
  const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeBase64Url(encodedSignature), signed);
  if (!verified) throw new HttpError(401, "Invalid signature");

  const now = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp <= now - 30) throw new HttpError(401, "Expired token");
  if (claims.nbf && claims.nbf > now + 30) throw new HttpError(401, "Token not active");
  if (claims.iss !== env.CLERK_ISSUER) throw new HttpError(401, "Invalid issuer");
  if (!audienceMatches(claims.aud, env.CLERK_AUDIENCE)) throw new HttpError(401, "Invalid audience");
  if (!authorizedPartyMatches(claims.azp, env.CLERK_AUTHORIZED_PARTIES)) throw new HttpError(401, "Invalid authorized party");
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
