import { HttpError } from "./security";
import type { AuthContext, Env, SecretBinding } from "./types";

async function readSecret(binding: SecretBinding | undefined): Promise<string | undefined> {
  if (!binding) return undefined;
  if (typeof binding === "string") return binding;
  try { return await binding.get(); }
  catch { return undefined; }
}

export async function assertInternalOperator(env: Env, auth: AuthContext): Promise<void> {
  const raw = await readSecret(env.ZBT_INTERNAL_OPERATOR_IDS);
  const allowed = new Set((raw ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  if (!allowed.size || !allowed.has(auth.userId)) {
    // Conceal the existence of the proprietary source-control plane from customers.
    throw new HttpError(404, "Not found");
  }
}
