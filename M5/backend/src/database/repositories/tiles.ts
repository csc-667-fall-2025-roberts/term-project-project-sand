import { pgp, pgPool } from "../index.js";
import type { DbClient } from "../dbClient.js";

export interface TileRecord {
  id: string;
  position: number;
  name: string;
  tile_type: string;
  property_group: string | null;
  purchase_price: number | null;
  rent_base: number | null;
  rent_house_1: number | null;
  rent_house_2: number | null;
  rent_house_3: number | null;
  rent_house_4: number | null;
  rent_hotel: number | null;
  house_cost: number | null;
  hotel_cost: number | null;
  created_at: Date;
}

export interface NewTile {
  position: number;
  name: string;
  tile_type: string;
  property_group?: string | null;
  purchase_price?: number | null;
  rent_base?: number | null;
  rent_house_1?: number | null;
  rent_house_2?: number | null;
  rent_house_3?: number | null;
  rent_house_4?: number | null;
  rent_hotel?: number | null;
  house_cost?: number | null;
  hotel_cost?: number | null;
}

export class TilesRepository {
  constructor(private readonly db: DbClient) {}

  async count(): Promise<number> {
    const row = await this.db.one<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM tiles",
    );
    return row.count;
  }

  async listAll(): Promise<TileRecord[]> {
    const query = `
      SELECT
        id,
        position,
        name,
        tile_type,
        property_group,
        purchase_price,
        rent_base,
        rent_house_1,
        rent_house_2,
        rent_house_3,
        rent_house_4,
        rent_hotel,
        house_cost,
        hotel_cost,
        created_at
      FROM tiles
      ORDER BY position ASC
    `;

    return this.db.manyOrNone(query);
  }

  async insertManyIgnoreConflicts(tiles: NewTile[]): Promise<number> {
    if (tiles.length === 0) return 0;

    const columns = new pgp.helpers.ColumnSet(
      [
        "position",
        "name",
        "tile_type",
        "property_group",
        "purchase_price",
        "rent_base",
        "rent_house_1",
        "rent_house_2",
        "rent_house_3",
        "rent_house_4",
        "rent_hotel",
        "house_cost",
        "hotel_cost",
      ],
      { table: "tiles" },
    );

    const values = tiles.map((t) => ({
      position: t.position,
      name: t.name,
      tile_type: t.tile_type,
      property_group: t.property_group ?? null,
      purchase_price: t.purchase_price ?? null,
      rent_base: t.rent_base ?? null,
      rent_house_1: t.rent_house_1 ?? null,
      rent_house_2: t.rent_house_2 ?? null,
      rent_house_3: t.rent_house_3 ?? null,
      rent_house_4: t.rent_house_4 ?? null,
      rent_hotel: t.rent_hotel ?? null,
      house_cost: t.house_cost ?? null,
      hotel_cost: t.hotel_cost ?? null,
    }));

    const insert = pgp.helpers.insert(values, columns);
    const query = `${insert} ON CONFLICT (position) DO NOTHING`;

    const result = await this.db.result(query);
    return result.rowCount;
  }
}

export const tilesRepository = new TilesRepository(pgPool);

export function createTilesRepository(db: DbClient): TilesRepository {
  return new TilesRepository(db);
}
