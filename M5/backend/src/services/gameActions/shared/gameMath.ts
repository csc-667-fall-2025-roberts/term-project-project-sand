export function computeRent(tile: {
  rent_base: number | null;
  purchase_price: number | null;
  houses?: number | null;
  hotels?: number | null;
}): number {
  const base =
    tile.rent_base != null
      ? tile.rent_base
      : tile.purchase_price != null
        ? Math.max(1, Math.floor(tile.purchase_price / 10))
        : 0;

  const houses = Math.max(0, Math.floor(tile.houses ?? 0));
  const hotels = Math.max(0, Math.floor(tile.hotels ?? 0));

  const multiplier = hotels > 0 ? 6 : 1 + Math.min(4, houses);

  return Math.max(0, Math.floor(base * multiplier));
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
      return 50;
    case "light-blue":
      return 50;
    case "pink":
      return 100;
    case "orange":
      return 100;
    case "red":
      return 150;
    case "yellow":
      return 150;
    case "green":
      return 200;
    case "dark-blue":
      return 200;
    default:
      return 0;
  }
}
