import type { Env } from "./types";
import { HttpError } from "./security";

let schemaReady: Promise<void> | undefined;

async function probeSchema(env: Env): Promise<void> {
  try {
    // Production schema is applied by Wrangler migrations during the Cloudflare
    // build. Runtime requests only verify that the expected schema is present.
    await env.DB.prepare("SELECT id FROM organizations LIMIT 1").first();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("database_schema_unavailable", { message: message.slice(0, 500) });
    throw new HttpError(503, "Database schema is unavailable");
  }
}

export async function ensureDatabase(env: Env): Promise<void> {
  if (!schemaReady) {
    schemaReady = probeSchema(env).catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}
