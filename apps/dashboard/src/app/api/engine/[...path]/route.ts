import { auth } from "@clerk/nextjs/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

async function forward(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path = [] } = await context.params;
  const isHealth = path.length === 1 && path[0] === "health";
  if (!isHealth) {
    const session = await auth();
    if (!session.isAuthenticated) return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { env } = getCloudflareContext();
  const url = new URL(request.url);
  url.pathname = `/api/${path.map(encodeURIComponent).join("/")}`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-zebrabyte-client", "darkweb-dashboard");

  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  const upstream = new Request(url.toString(), {
    method: request.method,
    headers,
    body,
    redirect: "manual"
  });

  const response = await env.INTELLIGENCE_API.fetch(upstream);
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("cache-control", "no-store, private");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
