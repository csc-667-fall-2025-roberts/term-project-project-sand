import { MigrationBuilder, type ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

const UNIQUE_USERS_DISPLAY_NAME_LOWER_INDEX = "users_display_name_lower_unique";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createExtension("pgcrypto", { ifNotExists: true });

  pgm.createTable("users", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    email: {
      type: "varchar(200)",
      notNull: true,
      unique: true,
    },
    display_name: {
      type: "varchar(500)",
      notNull: true,
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

  pgm.createIndex("users", "email");
  pgm.createIndex("users", "display_name");

  // Case-insensitive uniqueness for display_name.
  pgm.sql(
    `CREATE UNIQUE INDEX ${UNIQUE_USERS_DISPLAY_NAME_LOWER_INDEX} ON users (lower(display_name));`,
  );

  pgm.createTable("auth_credentials", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    password_hash: {
      type: "varchar(200)",
      notNull: true,
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

  pgm.addConstraint("auth_credentials", "auth_credentials_user_id_unique", {
    unique: ["user_id"],
  });

  pgm.createTable("refresh_tokens", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    token_hash: {
      type: "varchar(256)",
      notNull: true,
      unique: true,
    },
    expires_at: {
      type: "timestamp",
      notNull: true,
    },
    revoked_at: {
      type: "timestamp",
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("refresh_tokens", "user_id");
  pgm.createIndex("refresh_tokens", "expires_at");

  pgm.createTable("games", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    name: {
      type: "varchar(200)",
      notNull: true,
    },
    created_by: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    game_code: {
      type: "varchar(100)",
      notNull: true,
      unique: true,
    },
    status: {
      type: "varchar(200)",
      notNull: true,
      default: "waiting",
    },
    game_type: {
      type: "varchar(200)",
    },
    max_players: {
      type: "integer",
      notNull: true,
      default: 4,
    },
    turn_index: {
      type: "integer",
      default: 0,
    },
    started_at: {
      type: "timestamp",
    },
    ended_at: {
      type: "timestamp",
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
    starting_balance: {
      type: "integer",
      notNull: true,
      default: 1500,
    },
  });

  pgm.createIndex("games", "game_code");
  pgm.createIndex("games", "status");
  pgm.createIndex("games", "created_at");
  pgm.createIndex("games", "created_by");
  pgm.createIndex("games", "starting_balance");

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
    jail_turns: {
      type: "integer",
      notNull: true,
      default: 0,
    },
    goojf_cards: {
      type: "integer",
      notNull: true,
      default: 0,
    },
  });

  pgm.createIndex("game_participants", "game_id");
  pgm.createIndex("game_participants", "user_id");
  pgm.createIndex("game_participants", ["game_id", "user_id"], {
    unique: true,
  });

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
      notNull: true,
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

  pgm.createTable("turns", {
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
    participant_id: {
      type: "uuid",
      notNull: true,
      references: "game_participants(id)",
      onDelete: "CASCADE",
    },
    turn_number: {
      type: "integer",
      notNull: true,
    },
    dice_roll_1: {
      type: "integer",
    },
    dice_roll_2: {
      type: "integer",
    },
    is_double: {
      type: "boolean",
      default: false,
    },
    previous_position: {
      type: "integer",
    },
    new_position: {
      type: "integer",
    },
    action_taken: {
      type: "varchar(200)",
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("turns", "game_id");
  pgm.createIndex("turns", "participant_id");
  pgm.createIndex("turns", ["game_id", "turn_number"]);

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
      notNull: true,
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

  pgm.createTable("card_decks", {
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
    deck_type: {
      type: "varchar(50)",
      notNull: true,
    },
    current_index: {
      type: "integer",
      default: 0,
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("card_decks", "game_id");
  pgm.createIndex("card_decks", ["game_id", "deck_type"], { unique: true });

  pgm.createTable("cards", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    deck_type: {
      type: "varchar(50)",
      notNull: true,
    },
    card_order: {
      type: "integer",
      notNull: true,
    },
    message: {
      type: "text",
      notNull: true,
    },
    action_type: {
      type: "varchar(100)",
      notNull: true,
    },
    action_value: {
      type: "text",
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("cards", "deck_type");
  pgm.createIndex("cards", ["deck_type", "card_order"], { unique: true });

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

  pgm.createTable("chat_messages", {
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
    message: {
      type: "text",
      notNull: true,
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("chat_messages", "game_id");
  pgm.createIndex("chat_messages", "user_id");
  pgm.createIndex("chat_messages", "created_at");

  pgm.createTable("dashboard_chat_messages", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    message: {
      type: "text",
      notNull: true,
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createIndex("dashboard_chat_messages", "user_id");
  pgm.createIndex("dashboard_chat_messages", "created_at");

  pgm.createTable("trades", {
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
    initiator_id: {
      type: "uuid",
      notNull: true,
      references: "game_participants(id)",
      onDelete: "CASCADE",
    },
    recipient_id: {
      type: "uuid",
      notNull: true,
      references: "game_participants(id)",
      onDelete: "CASCADE",
    },
    initiator_cash: {
      type: "integer",
      default: 0,
    },
    recipient_cash: {
      type: "integer",
      default: 0,
    },
    status: {
      type: "varchar(50)",
      notNull: true,
      default: "pending",
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

  pgm.createIndex("trades", "game_id");
  pgm.createIndex("trades", "initiator_id");
  pgm.createIndex("trades", "recipient_id");
  pgm.createIndex("trades", "status");

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

  pgm.createTable("pending_actions", {
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
    participant_id: {
      type: "uuid",
      notNull: true,
      references: "game_participants(id)",
      onDelete: "CASCADE",
    },
    action_type: {
      type: "varchar(100)",
      notNull: true,
    },
    payload_json: {
      type: "jsonb",
    },
    status: {
      type: "varchar(50)",
      notNull: true,
      default: "pending",
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

  pgm.createIndex("pending_actions", "game_id");
  pgm.createIndex("pending_actions", "participant_id");
  pgm.createIndex("pending_actions", "status");
  pgm.createIndex("pending_actions", "created_at");
  pgm.createIndex("pending_actions", ["game_id", "participant_id"], {
    unique: true,
    where: "status = 'pending'",
    name: "pending_actions_one_active_per_player_per_game",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("pending_actions");
  pgm.dropTable("trade_properties");
  pgm.dropTable("trades");
  pgm.dropTable("dashboard_chat_messages");
  pgm.dropTable("chat_messages");
  pgm.dropTable("card_draws");
  pgm.dropTable("cards");
  pgm.dropTable("card_decks");
  pgm.dropTable("transactions");
  pgm.dropTable("turns");
  pgm.dropTable("ownerships");
  pgm.dropTable("tiles");
  pgm.dropTable("game_participants");
  pgm.dropTable("games");
  pgm.dropTable("refresh_tokens");
  pgm.dropTable("auth_credentials");
  pgm.dropTable("users");

  pgm.dropExtension("pgcrypto", { ifExists: true });
}
