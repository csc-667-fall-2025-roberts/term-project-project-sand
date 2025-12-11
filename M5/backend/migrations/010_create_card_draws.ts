import { MigrationBuilder, type ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("card_draws", {
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
    card_deck_id: {
      type: "uuid",
      notNull: true,
      references: "card_decks(id)",
      onDelete: "CASCADE",
    },
    card_id: {
      type: "uuid",
      notNull: true,
      references: "cards(id)",
      onDelete: "CASCADE",
    },
    participant_id: {
      type: "uuid",
      notNull: true,
      references: "game_participants(id)",
      onDelete: "CASCADE",
    },
    turn_id: {
      type: "uuid",
      references: "turns(id)",
      onDelete: "SET NULL",
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("card_draws", "game_id");
  pgm.createIndex("card_draws", "card_deck_id");
  pgm.createIndex("card_draws", "participant_id");
  pgm.createIndex("card_draws", "turn_id");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("card_draws");
}
