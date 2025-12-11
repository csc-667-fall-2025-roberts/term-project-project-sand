import { MigrationBuilder, type ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("ownerships", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    game_id: {
      type: "uuid",
      notNull: true,
      references: "games(id)",
      onDelete: "CASCADE",
    },
    tile_id: {
      type: "uuid",
      notNull: true,
      references: "tiles(id)",
      onDelete: "CASCADE",
    },
    participant_id: {
      type: "uuid",
      notNull: true,
      references: "game_participants(id)",
      onDelete: "CASCADE",
    },
    houses: {
      type: "integer",
      default: 0,
    },
    hotels: {
      type: "integer",
      default: 0,
    },
    is_mortgaged: {
      type: "boolean",
      default: false,
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
    updated_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("ownerships", "game_id");
  pgm.createIndex("ownerships", "tile_id");
  pgm.createIndex("ownerships", "participant_id");
  pgm.createIndex("ownerships", ["game_id", "tile_id"], { unique: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("ownerships");
}
