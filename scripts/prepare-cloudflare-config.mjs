import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const configPath = resolve(root, "wrangler.jsonc");
const wranglerBin = resolve(root, "node_modules", ".bin", "wrangler");

const DB_NAME = "zebrabyte-darkweb-intelligence-prod";
const R2_BUCKET = "zbtdarkweb-scan-evidence";
const FLAGSHIP_APP = "zebrabyte-darkweb-intelligence";

if (!existsSync(wranglerBin)) {
  throw new Error("Wrangler binary is unavailable; cannot reconcile Cloudflare resources.");
}

function wrangler(args, options = {}) {
  return execFileSync(wranglerBin, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", options.inheritStderr ? "inherit" : "pipe"],
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
    const start = [arrayStart, objectStart].filter((value) => value >= 0).sort((a, b) => a - b)[0];
    if (start === undefined) throw new Error(`Expected JSON from Wrangler but received: ${text.slice(0, 240)}`);
    return JSON.parse(text.slice(start));
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ["result", "apps", "items", "databases"]) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
}

function resourceId(resource) {
  if (!resource || typeof resource !== "object") return undefined;
  for (const key of ["uuid", "id", "database_id", "app_id"]) {
    const value = resource[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function loadConfig() {
  return JSON.parse(readFileSync(configPath, "utf8"));
}

function saveConfig(config) {
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function ensureD1() {
  let databases = asArray(parseJsonOutput(wrangler(["d1", "list", "--json"])));
  let database = databases.find((item) => item?.name === DB_NAME);

  if (!database) {
    console.log(`[cloudflare-sync] Creating D1 ${DB_NAME}`);
    wrangler(["d1", "create", DB_NAME, "--location", "weur", "--binding", "DB", "--update-config"], { inheritStderr: true });
    databases = asArray(parseJsonOutput(wrangler(["d1", "list", "--json"])));
    database = databases.find((item) => item?.name === DB_NAME);
  }

  const id = resourceId(database);
  if (!id) throw new Error(`Unable to resolve database_id for D1 ${DB_NAME}.`);
  return id;
}

function ensureR2() {
  try {
    wrangler(["r2", "bucket", "info", R2_BUCKET, "--json"]);
  } catch {
    console.log(`[cloudflare-sync] Creating R2 ${R2_BUCKET}`);
    wrangler(["r2", "bucket", "create", R2_BUCKET], { inheritStderr: true });
  }
}

function ensureFlagship() {
  let apps = asArray(parseJsonOutput(wrangler(["flagship", "apps", "list", "--json"])));
  let app = apps.find((item) => item?.name === FLAGSHIP_APP);

  if (!app) {
    console.log(`[cloudflare-sync] Creating Flagship app ${FLAGSHIP_APP}`);
    app = parseJsonOutput(wrangler(["flagship", "apps", "create", FLAGSHIP_APP, "--json"]));
  }

  const id = resourceId(app);
  if (!id) throw new Error(`Unable to resolve app_id for Flagship app ${FLAGSHIP_APP}.`);
  return id;
}

const databaseId = ensureD1();
ensureR2();
const flagshipAppId = ensureFlagship();

const config = loadConfig();
config.ai = { binding: "AI" };
config.d1_databases = [
  {
    binding: "DB",
    database_name: DB_NAME,
    database_id: databaseId,
    migrations_dir: "migrations",
  },
];
config.r2_buckets = [{ binding: "EVIDENCE", bucket_name: R2_BUCKET }];
config.flagship = [{ binding: "FLAGS", app_id: flagshipAppId }];

saveConfig(config);
console.log("[cloudflare-sync] Cloudflare bindings reconciled: Workers AI, D1, R2 and Flagship are pinned for this deployment.");
