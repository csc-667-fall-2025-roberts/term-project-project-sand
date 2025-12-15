export const AUTO_TOKEN_COLORS = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "black",
] as const;

export type TokenColor = (typeof AUTO_TOKEN_COLORS)[number];

export function normalizeTokenColor(value: string): string {
  return value.trim().toLowerCase();
}

export function parseTokenColor(value: string): TokenColor | null {
  const normalized = normalizeTokenColor(value);
  return (AUTO_TOKEN_COLORS as readonly string[]).includes(normalized)
    ? (normalized as TokenColor)
    : null;
}
