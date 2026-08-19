import { HttpError } from "./security";
import type { SecretBinding } from "./types";

export async function readRequiredSecret(binding: SecretBinding | undefined, label: string): Promise<string> {
  let value = "";
  if (typeof binding === "string") {
    value = binding;
  } else if (binding && typeof binding.get === "function") {
    value = await binding.get();
  }
  const normalized = value.trim();
  if (!normalized) throw new HttpError(503, `${label} is not configured`);
  return normalized;
}
