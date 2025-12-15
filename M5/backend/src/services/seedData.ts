import { allSeedCardsByDeck } from "../gameData/cards.js";
import { sfBoardTiles } from "../gameData/sfBoard.js";
import type { DbClient } from "../database/dbClient.js";
import { createCardsRepository } from "../database/repositories/cards.js";
import { createTilesRepository } from "../database/repositories/tiles.js";

function requiredPositions(): number[] {
  return Array.from({ length: 40 }, (_, i) => i);
}

export async function ensureSfBoardSeeded(db: DbClient): Promise<void> {
  const tilesRepo = createTilesRepository(db);
  const count = await tilesRepo.count();

  if (count === 0) {
    const inserted = await tilesRepo.insertManyIgnoreConflicts(sfBoardTiles);

    if (inserted !== sfBoardTiles.length) {
      const afterCount = await tilesRepo.count();
      if (afterCount < sfBoardTiles.length) {
        throw new Error(
          `Failed to seed tiles: inserted=${inserted} expected=${sfBoardTiles.length}`,
        );
      }
    }

    return;
  }

  // If tiles already exist, validate that positions 0..39 are present.
  const rows = await tilesRepo.listAll();
  const existingPositions = new Set(rows.map((r) => r.position));
  const missing = requiredPositions().filter((p) => !existingPositions.has(p));

  if (missing.length > 0) {
    throw new Error(
      `Tiles table is partially seeded; missing positions: ${missing.join(", ")}`,
    );
  }
}

export async function ensureCardsSeeded(db: DbClient): Promise<void> {
  const cardsRepo = createCardsRepository(db);

  for (const deckType of Object.keys(
    allSeedCardsByDeck,
  ) as (keyof typeof allSeedCardsByDeck)[]) {
    const cards = allSeedCardsByDeck[deckType];
    const existing = await cardsRepo.listByDeckType(deckType);
    const existingOrders = new Set(existing.map((c) => c.card_order));
    const missing = cards.filter((c) => !existingOrders.has(c.card_order));
    if (missing.length === 0) continue;

    const inserted = await cardsRepo.insertManyIgnoreConflicts(missing);

    if (inserted !== missing.length) {
      // If we inserted less, it likely means existing constraints/data; treat as error
      // because the deck would be incomplete.
      const afterCount = await cardsRepo.countByDeckType(deckType);
      if (afterCount < cards.length) {
        throw new Error(
          `Failed to seed cards for ${deckType}: inserted=${inserted} expected=${missing.length}`,
        );
      }
    }
  }
}

export async function ensureReferenceDataSeeded(db: DbClient): Promise<void> {
  await ensureSfBoardSeeded(db);
  await ensureCardsSeeded(db);
}
