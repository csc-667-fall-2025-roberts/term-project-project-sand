import { MigrationBuilder, type ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("trade_properties", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    trade_id: {
      type: "uuid",
      notNull: true,
      references: "trades(id)",
      onDelete: "CASCADE",
    },
    ownership_id: {
      type: "uuid",
      notNull: true,
      references: "ownerships(id)",
      onDelete: "CASCADE",
    },
    from_participant_id: {
      type: "uuid",
      notNull: true,
      references: "game_participants(id)",
      onDelete: "CASCADE",
    },
    to_participant_id: {
      type: "uuid",
      notNull: true,
      references: "game_participants(id)",
      onDelete: "CASCADE",
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("trade_properties", "trade_id");
  pgm.createIndex("trade_properties", "ownership_id");
  pgm.createIndex("trade_properties", "from_participant_id");
  pgm.createIndex("trade_properties", "to_participant_id");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("trade_properties");
}
