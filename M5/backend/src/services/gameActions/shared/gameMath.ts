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

export function upgradeCostForGroup(group: string | null): number {
  //this section may have to change to match our coloring schemes
  switch ((group ?? "").toLowerCase()) {
    case "brown":
    case "light_blue":
      return 50;
    case "pink":
    case "orange":
      return 100;
    case "red":
    case "yellow":
      return 150;
    case "green":
    case "dark_blue":
      return 200;
    default:
      return 0;
  }
}