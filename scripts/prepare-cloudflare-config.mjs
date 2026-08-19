import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const configPath = resolve(root, "wrangler.jsonc");
const wranglerBin = resolve(root, "node_modules", ".bin", "wrangler");

const DB_NAME = "zebrabyte-darkweb-intelligence-prod";
const R2_BUCKET = "zbtdarkweb-scan-evidence";

if (!existsSync(wranglerBin)) {
  throw new Error("Wrangler binary is unavailable; cannot resolve the production D1 binding.");
}

function wrangler(args) {
  return execFileSync(wranglerBin, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  }).trim();
}

function parseJsonOutput(output) {
  const text = String(output || "").trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    const arrayStart = text.indexOf("[");
    const objectStart = text.indexOf("{");
    const start = [arrayStart, objectStart]
      .filter((value) => value >= 0)
      .sort((a, b) => a - b)[0];
    if (start === undefined) {
      throw new Error(`Expected JSON from Wrangler but received: ${text.slice(0, 240)}`);
    }
    return JSON.parse(text.slice(start));
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ["result", "items", "databases"]) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
}

function databaseId(database) {
  if (!database || typeof database !== "object") return undefined;
  for (const key of ["uuid", "id", "database_id"]) {
    const value = database[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function ensureD1() {
  let databases = asArray(parseJsonOutput(wrangler(["d1", "list", "--json"])));
  let database = databases.find((item) => item?.name === DB_NAME);

  if (!database) {
    console.log(`[cloudflare-sync] Creating D1 ${DB_NAME}`);
    wrangler(["d1", "create", DB_NAME, "--location", "weur"]);
    databases = asArray(parseJsonOutput(wrangler(["d1", "list", "--json"])));
    database = databases.find((item) => item?.name === DB_NAME);
  }

  const id = databaseId(database);
  if (!id) throw new Error(`Unable to resolve database_id for D1 ${DB_NAME}.`);
  return id;
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const id = ensureD1();

// Production uses Cloudflare Workers AI directly. No external AI provider is required.
config.ai = { binding: "AI" };

// Pin the existing production D1 by its real account UUID so Git-connected
// deploys never attempt to auto-provision the same database again.
config.d1_databases = [
  {
    binding: "DB",
    database_name: DB_NAME,
    database_id: id,
    migrations_dir: "migrations",
  },
];

// The bucket already exists in the account. An explicit bucket_name binds it
// without any R2 list/create API call during dependency installation.
config.r2_buckets = [{ binding: "EVIDENCE", bucket_name: R2_BUCKET }];

// Flagship is optional in application code. The Cloudflare Build API token
// currently lacks Flagship Read/Write, so do not make installation/deployment
// depend on that separate account permission.
delete config.flagship;

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`[cloudflare-sync] Pinned D1 ${DB_NAME} (${id}) and R2 ${R2_BUCKET}; Workers AI is native Cloudflare.`);
