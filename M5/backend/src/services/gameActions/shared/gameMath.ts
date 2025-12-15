export function computeRent(tile: {
  rent_base: number | null;
  purchase_price: number | null;
}): number {
  if (tile.rent_base != null) return tile.rent_base;
  if (tile.purchase_price != null)
    return Math.max(1, Math.floor(tile.purchase_price / 10));
  return 0;
}

export function taxForTileName(name: string): number {
  if (name.toLowerCase().includes("income")) return 200;
  if (name.toLowerCase().includes("luxury")) return 100;
  return 100;
}
