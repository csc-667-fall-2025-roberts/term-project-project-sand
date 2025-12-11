import { MigrationBuilder, type ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("tiles", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    position: {
      type: "integer",
      notNull: true,
      unique: true,
    },
    name: {
      type: "varchar(200)",
      notNull: true,
    },
    tile_type: {
      type: "varchar(100)",
      notNull: true, // 'property', 'chance', 'community_chest', 'tax', 'go', 'jail', 'free_parking', 'go_to_jail'
    },
    property_group: {
      type: "varchar(50)",
    },
    purchase_price: {
      type: "integer",
    },
    rent_base: {
      type: "integer",
    },
    rent_house_1: {
      type: "integer",
    },
    rent_house_2: {
      type: "integer",
    },
    rent_house_3: {
      type: "integer",
    },
    rent_house_4: {
      type: "integer",
    },
    rent_hotel: {
      type: "integer",
    },
    house_cost: {
      type: "integer",
    },
    hotel_cost: {
      type: "integer",
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("tiles", "position");
  pgm.createIndex("tiles", "tile_type");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("tiles");
}
