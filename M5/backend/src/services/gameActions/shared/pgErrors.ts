import { isRecord } from "./typeGuards.js";

export function pgErrorCode(error: unknown): string | null {
  if (!isRecord(error)) return null;
  const code = error["code"];
  return typeof code === "string" ? code : null;
}

export function pgConstraint(error: unknown): string | null {
  if (!isRecord(error)) return null;
  const constraint = error["constraint"];
  return typeof constraint === "string" ? constraint : null;
}
