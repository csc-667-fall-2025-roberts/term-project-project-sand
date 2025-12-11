import { MigrationBuilder, type ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("game_participants", {
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
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    cash: {
      type: "integer",
      notNull: true,
      default: 1500,
    },
    token_color: {
      type: "varchar(50)",
    },
    position: {
      type: "integer",
      default: 0,
    },
    in_jail: {
      type: "boolean",
      default: false,
    },
    get_out_of_jail_turns: {
      type: "integer",
      default: 0,
    },
    is_bankrupt: {
      type: "boolean",
      default: false,
    },
    joined_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
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

  pgm.createIndex("game_participants", "game_id");
  pgm.createIndex("game_participants", "user_id");
  pgm.createIndex("game_participants", ["game_id", "user_id"], {
    unique: true,
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("game_participants");
}
