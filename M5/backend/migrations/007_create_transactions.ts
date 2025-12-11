import { MigrationBuilder, type ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("transactions", {
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
    turn_id: {
      type: "uuid",
      references: "turns(id)",
      onDelete: "SET NULL",
    },
    from_participant_id: {
      type: "uuid",
      references: "game_participants(id)",
      onDelete: "SET NULL",
    },
    to_participant_id: {
      type: "uuid",
      references: "game_participants(id)",
      onDelete: "SET NULL",
    },
    amount: {
      type: "integer",
      notNull: true,
    },
    transaction_type: {
      type: "varchar(100)",
      notNull: true, // 'rent', 'purchase', 'tax', 'pass_go', 'card', 'trade', etc.
    },
    description: {
      type: "text",
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("transactions", "game_id");
  pgm.createIndex("transactions", "turn_id");
  pgm.createIndex("transactions", "from_participant_id");
  pgm.createIndex("transactions", "to_participant_id");
  pgm.createIndex("transactions", "transaction_type");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("transactions");
}
